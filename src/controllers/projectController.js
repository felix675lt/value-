const db = require('../config/database');

const MIN_DAILY_RATE = parseInt(process.env.MIN_DAILY_RATE) || 300000;

// POST /api/projects
async function createProject(req, res, next) {
  try {
    const {
      title, category, description, required_background,
      duration_days, budget_min, budget_max,
      has_incentive, incentive_condition, incentive_amount,
      work_type, region,
    } = req.body;

    if (budget_min < MIN_DAILY_RATE) {
      return res.status(400).json({
        error: `최저 일당은 ${MIN_DAILY_RATE.toLocaleString()}원 이상이어야 합니다.`,
      });
    }

    const [project] = await db('projects')
      .insert({
        client_id: req.user.id,
        title, category, description, required_background,
        duration_days, budget_min, budget_max,
        has_incentive: has_incentive || false,
        incentive_condition,
        incentive_amount,
        work_type: work_type || 'remote',
        region,
      })
      .returning('*');

    res.status(201).json(project);
  } catch (err) {
    next(err);
  }
}

// GET /api/projects
async function listProjects(req, res, next) {
  try {
    const { category, work_type, region, min_budget, max_budget, status, page = 1, limit = 20 } = req.query;

    // [MEDIUM] client_email 노출 제거 — 개인정보 보호
    let query = db('projects')
      .select('projects.*')
      .orderBy('projects.created_at', 'desc');

    if (category) query = query.where('projects.category', category);
    if (work_type) query = query.where('projects.work_type', work_type);
    // [HIGH] LIKE injection 방지 — 와일드카드 문자 이스케이프
    if (region) {
      const safeRegion = region.replace(/[%_\\]/g, '\\$&');
      query = query.where('projects.region', 'ilike', `%${safeRegion}%`);
    }
    if (min_budget) query = query.where('projects.budget_max', '>=', parseInt(min_budget));
    if (max_budget) query = query.where('projects.budget_min', '<=', parseInt(max_budget));
    if (status) {
      query = query.where('projects.status', status);
    } else {
      query = query.where('projects.status', 'open');
    }

    // [MEDIUM] Pagination 상한 제한
    const safeLimit = Math.min(parseInt(limit) || 20, 100);
    const safePage = Math.max(parseInt(page) || 1, 1);
    const offset = (safePage - 1) * safeLimit;
    const projects = await query.limit(safeLimit).offset(offset);

    const [{ count }] = await db('projects')
      .where('status', status || 'open')
      .count();

    res.json({ data: projects, total: parseInt(count), page: safePage, limit: safeLimit });
  } catch (err) {
    next(err);
  }
}

// GET /api/projects/:id
async function getProject(req, res, next) {
  try {
    // [MEDIUM] client_email 노출 제거
    const project = await db('projects')
      .select('projects.*')
      .where('projects.id', req.params.id)
      .first();

    if (!project) return res.status(404).json({ error: '프로젝트를 찾을 수 없습니다.' });

    const proposalCount = await db('proposals')
      .where({ project_id: project.id })
      .count()
      .first();

    res.json({ ...project, proposal_count: parseInt(proposalCount.count) });
  } catch (err) {
    next(err);
  }
}

// PUT /api/projects/:id
async function updateProject(req, res, next) {
  try {
    const project = await db('projects').where({ id: req.params.id, client_id: req.user.id }).first();
    if (!project) return res.status(404).json({ error: '프로젝트를 찾을 수 없습니다.' });
    if (project.status !== 'open') {
      return res.status(400).json({ error: '진행 중인 프로젝트는 수정할 수 없습니다.' });
    }

    const allowed = [
      'title', 'category', 'description', 'required_background',
      'duration_days', 'budget_min', 'budget_max',
      'has_incentive', 'incentive_condition', 'incentive_amount',
      'work_type', 'region',
    ];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }
    updates.updated_at = db.fn.now();

    const [updated] = await db('projects').where({ id: req.params.id }).update(updates).returning('*');
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// DELETE /api/projects/:id (cancel)
async function cancelProject(req, res, next) {
  try {
    const project = await db('projects').where({ id: req.params.id, client_id: req.user.id }).first();
    if (!project) return res.status(404).json({ error: '프로젝트를 찾을 수 없습니다.' });
    if (!['open', 'matched'].includes(project.status)) {
      return res.status(400).json({ error: '진행 중인 프로젝트는 취소할 수 없습니다.' });
    }

    const [updated] = await db('projects')
      .where({ id: req.params.id })
      .update({ status: 'cancelled', updated_at: db.fn.now() })
      .returning('*');
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

// GET /api/projects/my — Client's own projects
async function myProjects(req, res, next) {
  try {
    const projects = await db('projects')
      .where({ client_id: req.user.id })
      .orderBy('created_at', 'desc');
    res.json(projects);
  } catch (err) {
    next(err);
  }
}

module.exports = { createProject, listProjects, getProject, updateProject, cancelProject, myProjects };
