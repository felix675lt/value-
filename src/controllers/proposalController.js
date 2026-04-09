const db = require('../config/database');

const MIN_DAILY_RATE = parseInt(process.env.MIN_DAILY_RATE) || 300000;

// POST /api/projects/:projectId/proposals
async function submitProposal(req, res, next) {
  try {
    const { projectId } = req.params;
    const expertId = req.user.id;

    const project = await db('projects').where({ id: projectId, status: 'open' }).first();
    if (!project) {
      return res.status(404).json({ error: '지원 가능한 프로젝트가 아닙니다.' });
    }

    // [CRITICAL] 자기거래 방지 — 자기 프로젝트에 제안서 제출 차단
    if (project.client_id === expertId) {
      return res.status(403).json({ error: '본인이 등록한 프로젝트에는 제안서를 제출할 수 없습니다.' });
    }

    const existing = await db('proposals')
      .where({ project_id: projectId, expert_id: expertId })
      .first();
    if (existing) {
      return res.status(409).json({ error: '이미 제안서를 제출하셨습니다.' });
    }

    const { proposed_daily_rate, proposed_incentive_condition, cover_message, expected_deliverable } = req.body;

    if (proposed_daily_rate < MIN_DAILY_RATE) {
      return res.status(400).json({
        error: `최저 일당은 ${MIN_DAILY_RATE.toLocaleString()}원 이상이어야 합니다.`,
      });
    }

    const [proposal] = await db('proposals')
      .insert({
        project_id: projectId,
        expert_id: expertId,
        proposed_daily_rate,
        proposed_incentive_condition,
        cover_message,
        expected_deliverable,
      })
      .returning('*');

    res.status(201).json(proposal);
  } catch (err) {
    next(err);
  }
}

// GET /api/projects/:projectId/proposals — Client views proposals
async function listProposals(req, res, next) {
  try {
    const { projectId } = req.params;

    const project = await db('projects').where({ id: projectId }).first();
    if (!project) return res.status(404).json({ error: '프로젝트를 찾을 수 없습니다.' });

    // Client만 전체 제안서 목록 조회 가능
    if (project.client_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }

    const proposals = await db('proposals')
      .select(
        'proposals.*',
        'expert_profiles.name as expert_name',
        'expert_profiles.rating_avg',
        'expert_profiles.project_count',
        'expert_profiles.verified_level',
      )
      .leftJoin('expert_profiles', 'expert_profiles.user_id', 'proposals.expert_id')
      .where({ project_id: projectId })
      .orderBy('proposals.created_at', 'asc');

    res.json(proposals);
  } catch (err) {
    next(err);
  }
}

// POST /api/proposals/:id/accept — Client accepts a proposal → create contract
async function acceptProposal(req, res, next) {
  try {
    const proposal = await db('proposals').where({ id: req.params.id, status: 'pending' }).first();
    if (!proposal) return res.status(404).json({ error: '제안서를 찾을 수 없습니다.' });

    const project = await db('projects').where({ id: proposal.project_id }).first();
    if (project.client_id !== req.user.id) {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }
    if (project.status !== 'open') {
      return res.status(400).json({ error: '이미 매칭된 프로젝트입니다.' });
    }

    const { start_date } = req.body;
    const totalAmount = proposal.proposed_daily_rate * project.duration_days;

    const result = await db.transaction(async (trx) => {
      // 제안서 수락
      await trx('proposals').where({ id: proposal.id }).update({ status: 'accepted' });

      // 다른 제안서 거절
      await trx('proposals')
        .where({ project_id: project.id })
        .whereNot({ id: proposal.id })
        .update({ status: 'rejected' });

      // 프로젝트 상태 변경
      await trx('projects').where({ id: project.id }).update({ status: 'matched' });

      // 계약 생성
      const endDate = new Date(start_date);
      endDate.setDate(endDate.getDate() + project.duration_days - 1);

      const [contract] = await trx('contracts')
        .insert({
          project_id: project.id,
          expert_id: proposal.expert_id,
          client_id: req.user.id,
          daily_rate: proposal.proposed_daily_rate,
          total_amount: totalAmount,
          start_date,
          end_date: endDate.toISOString().split('T')[0],
          incentive_condition: proposal.proposed_incentive_condition || project.incentive_condition,
          incentive_amount: project.incentive_amount,
          status: 'pending_escrow',
        })
        .returning('*');

      // 에스크로 레코드 생성
      await trx('escrows').insert({
        contract_id: contract.id,
        total_deposited: 0,
        status: 'pending',
      });

      return contract;
    });

    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

// GET /api/experts/my/proposals — Expert's own proposals
async function myProposals(req, res, next) {
  try {
    const proposals = await db('proposals')
      .select('proposals.*', 'projects.title as project_title', 'projects.category', 'projects.status as project_status')
      .join('projects', 'projects.id', 'proposals.project_id')
      .where({ expert_id: req.user.id })
      .orderBy('proposals.created_at', 'desc');
    res.json(proposals);
  } catch (err) {
    next(err);
  }
}

module.exports = { submitProposal, listProposals, acceptProposal, myProposals };
