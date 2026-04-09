const db = require('../config/database');
const { confirmPayment } = require('../services/paymentService');

const PLATFORM_FEE_RATE = parseFloat(process.env.PLATFORM_FEE_RATE) || 0.12;
const WITHHOLDING_TAX_RATE = parseFloat(process.env.WITHHOLDING_TAX_RATE) || 0.033;

// GET /api/contracts/:id
async function getContract(req, res, next) {
  try {
    const contract = await db('contracts').where({ id: req.params.id }).first();
    if (!contract) return res.status(404).json({ error: '계약을 찾을 수 없습니다.' });

    if (contract.client_id !== req.user.id && contract.expert_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }

    const escrow = await db('escrows').where({ contract_id: contract.id }).first();
    const completions = await db('daily_completions')
      .where({ contract_id: contract.id })
      .orderBy('work_date', 'asc');

    res.json({ ...contract, escrow, completions });
  } catch (err) {
    next(err);
  }
}

// GET /api/contracts/my
async function myContracts(req, res, next) {
  try {
    const userId = req.user.id;
    const contracts = await db('contracts')
      .select('contracts.*', 'projects.title as project_title')
      .join('projects', 'projects.id', 'contracts.project_id')
      .where(function () {
        this.where('contracts.client_id', userId).orWhere('contracts.expert_id', userId);
      })
      .orderBy('contracts.created_at', 'desc');
    res.json(contracts);
  } catch (err) {
    next(err);
  }
}

// POST /api/contracts/:id/escrow/deposit — Client deposits escrow
// [CRITICAL] 토스페이먼츠 서버사이드 결제 검증 추가
async function depositEscrow(req, res, next) {
  try {
    const contract = await db('contracts').where({ id: req.params.id, client_id: req.user.id }).first();
    if (!contract) return res.status(404).json({ error: '계약을 찾을 수 없습니다.' });
    if (contract.status !== 'pending_escrow') {
      return res.status(400).json({ error: '에스크로 예치 대기 상태가 아닙니다.' });
    }

    const { payment_key, order_id } = req.body;

    const platformFee = Math.round(contract.total_amount * PLATFORM_FEE_RATE);
    const depositAmount = contract.total_amount + platformFee;

    // [CRITICAL] 토스페이먼츠 결제 승인 — 금액 서버사이드 검증
    const paymentResult = await confirmPayment(payment_key, order_id, depositAmount);

    // 결제 금액 일치 확인
    if (paymentResult.totalAmount !== depositAmount) {
      return res.status(400).json({
        error: '결제 금액이 일치하지 않습니다.',
        expected: depositAmount,
        received: paymentResult.totalAmount,
      });
    }

    await db.transaction(async (trx) => {
      await trx('escrows')
        .where({ contract_id: contract.id })
        .update({
          total_deposited: depositAmount,
          payment_key,
          status: 'holding',
          updated_at: trx.fn.now(),
        });

      await trx('contracts')
        .where({ id: contract.id })
        .update({ status: 'active', updated_at: trx.fn.now() });

      await trx('projects')
        .where({ id: contract.project_id })
        .update({ status: 'ongoing', updated_at: trx.fn.now() });

      await trx('payments').insert({
        contract_id: contract.id,
        amount: platformFee,
        type: 'platform_fee',
        direction: 'in',
        status: 'completed',
        metadata: JSON.stringify({ payment_key, order_id }),
      });

      await trx('payments').insert({
        contract_id: contract.id,
        amount: contract.total_amount,
        type: 'daily',
        direction: 'in',
        status: 'completed',
        metadata: JSON.stringify({ payment_key, order_id, note: 'escrow_deposit' }),
      });
    });

    const escrow = await db('escrows').where({ contract_id: contract.id }).first();
    res.json({ message: '에스크로 예치 완료', escrow });
  } catch (err) {
    next(err);
  }
}

// POST /api/contracts/:id/daily-check — Expert checks daily completion
async function expertDailyCheck(req, res, next) {
  try {
    const contract = await db('contracts')
      .where({ id: req.params.id, expert_id: req.user.id, status: 'active' })
      .first();
    if (!contract) return res.status(404).json({ error: '활성 계약을 찾을 수 없습니다.' });

    const { work_date } = req.body;

    // [MEDIUM] 근무일 유효성 검증 — 계약 기간 내 + 미래 날짜 차단
    const today = new Date().toISOString().split('T')[0];
    if (work_date > today) {
      return res.status(400).json({ error: '미래 날짜에는 완료 체크할 수 없습니다.' });
    }
    if (work_date < contract.start_date.toISOString().split('T')[0]) {
      return res.status(400).json({ error: '계약 시작일 이전 날짜입니다.' });
    }
    if (work_date > contract.end_date.toISOString().split('T')[0]) {
      return res.status(400).json({ error: '계약 종료일 이후 날짜입니다.' });
    }

    const existing = await db('daily_completions')
      .where({ contract_id: contract.id, work_date })
      .first();
    if (existing) {
      return res.status(409).json({ error: '이미 완료 체크한 날짜입니다.' });
    }

    const [completion] = await db('daily_completions')
      .insert({
        contract_id: contract.id,
        work_date,
        expert_checked_at: new Date(),
      })
      .returning('*');

    res.status(201).json(completion);
  } catch (err) {
    next(err);
  }
}

// POST /api/contracts/:id/daily-confirm — Client confirms & triggers payment
async function clientDailyConfirm(req, res, next) {
  try {
    const contract = await db('contracts')
      .where({ id: req.params.id, client_id: req.user.id, status: 'active' })
      .first();
    if (!contract) return res.status(404).json({ error: '활성 계약을 찾을 수 없습니다.' });

    const { work_date } = req.body;

    const completion = await db('daily_completions')
      .where({ contract_id: contract.id, work_date })
      .whereNotNull('expert_checked_at')
      .first();
    if (!completion) {
      return res.status(404).json({ error: '전문가의 완료 체크가 없습니다.' });
    }
    if (completion.client_confirmed_at) {
      return res.status(409).json({ error: '이미 확인된 근무일입니다.' });
    }

    // [MEDIUM] 에스크로 잔액 검증 — 과다 지급 방지
    const escrow = await db('escrows').where({ contract_id: contract.id }).first();
    const dailyRate = contract.daily_rate;
    const remaining = escrow.total_deposited - escrow.total_released;
    if (remaining < dailyRate) {
      return res.status(400).json({ error: '에스크로 잔액이 부족합니다.' });
    }

    const withholdingTax = Math.round(dailyRate * WITHHOLDING_TAX_RATE);
    const expertPayout = dailyRate - withholdingTax;

    await db.transaction(async (trx) => {
      await trx('daily_completions')
        .where({ id: completion.id })
        .update({
          client_confirmed_at: new Date(),
          payment_status: 'paid',
          paid_at: new Date(),
        });

      await trx('escrows')
        .where({ contract_id: contract.id })
        .increment('total_released', dailyRate);

      await trx('payments').insert({
        contract_id: contract.id,
        amount: expertPayout,
        type: 'daily',
        direction: 'out',
        status: 'completed',
        metadata: JSON.stringify({ work_date, gross: dailyRate, withholding_tax: withholdingTax }),
      });

      await trx('payments').insert({
        contract_id: contract.id,
        amount: withholdingTax,
        type: 'withholding_tax',
        direction: 'in',
        status: 'completed',
        metadata: JSON.stringify({ work_date }),
      });

      // 모든 근무일 완료 확인
      const totalPaid = await trx('daily_completions')
        .where({ contract_id: contract.id, payment_status: 'paid' })
        .count()
        .first();

      const totalDays = Math.round(contract.total_amount / contract.daily_rate);
      if (parseInt(totalPaid.count) >= totalDays) {
        await trx('contracts')
          .where({ id: contract.id })
          .update({ status: 'completed', updated_at: trx.fn.now() });
        await trx('projects')
          .where({ id: contract.project_id })
          .update({ status: 'completed', updated_at: trx.fn.now() });
        await trx('escrows')
          .where({ contract_id: contract.id })
          .update({ status: 'released', updated_at: trx.fn.now() });

        await trx('expert_profiles')
          .where({ user_id: contract.expert_id })
          .increment('project_count', 1);
      }
    });

    res.json({
      message: '근무 확인 및 지급 완료',
      work_date,
      gross: dailyRate,
      withholding_tax: withholdingTax,
      net_payout: expertPayout,
    });
  } catch (err) {
    next(err);
  }
}

// GET /api/contracts/:id/payments
async function getPayments(req, res, next) {
  try {
    const contract = await db('contracts').where({ id: req.params.id }).first();
    if (!contract) return res.status(404).json({ error: '계약을 찾을 수 없습니다.' });

    if (contract.client_id !== req.user.id && contract.expert_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }

    const payments = await db('payments')
      .where({ contract_id: contract.id })
      .orderBy('created_at', 'desc');
    res.json(payments);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getContract, myContracts, depositEscrow,
  expertDailyCheck, clientDailyConfirm, getPayments,
};
