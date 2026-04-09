const db = require('../config/database');

// POST /api/experts/profile
async function createProfile(req, res, next) {
  try {
    const userId = req.user.id;
    const exists = await db('expert_profiles').where({ user_id: userId }).first();
    if (exists) {
      return res.status(409).json({ error: '프로필이 이미 존재합니다.' });
    }

    const {
      name, photo_url, video_url,
      min_daily_rate, max_daily_rate,
      accept_incentive, available_remote, regions,
      careers, tags,
    } = req.body;

    await db.transaction(async (trx) => {
      await trx('expert_profiles').insert({
        user_id: userId,
        name,
        photo_url,
        video_url,
        min_daily_rate,
        max_daily_rate,
        accept_incentive,
        available_remote,
        regions: regions || [],
      });

      // [HIGH] Mass Assignment 방지 — 허용 필드만 추출
      if (careers?.length) {
        const allowedCareerFields = ['company_name', 'industry', 'position', 'start_year', 'end_year', 'description'];
        await trx('expert_careers').insert(
          careers.map((c) => {
            const safe = { expert_id: userId };
            for (const key of allowedCareerFields) {
              if (c[key] !== undefined) safe[key] = c[key];
            }
            return safe;
          }),
        );
      }

      if (tags?.length) {
        const validTagTypes = ['network', 'skill', 'industry'];
        await trx('expert_tags').insert(
          tags.map((t) => ({
            expert_id: userId,
            tag_name: String(t.tag_name).slice(0, 50),
            tag_type: validTagTypes.includes(t.tag_type) ? t.tag_type : 'skill',
          })),
        );
      }
    });

    const profile = await getFullProfile(userId);
    res.status(201).json(profile);
  } catch (err) {
    next(err);
  }
}

// GET /api/experts/profile
async function getMyProfile(req, res, next) {
  try {
    const profile = await getFullProfile(req.user.id);
    if (!profile) return res.status(404).json({ error: '프로필이 없습니다.' });
    res.json(profile);
  } catch (err) {
    next(err);
  }
}

// PUT /api/experts/profile
async function updateProfile(req, res, next) {
  try {
    const userId = req.user.id;
    const {
      name, photo_url, video_url,
      min_daily_rate, max_daily_rate,
      accept_incentive, available_remote, regions,
    } = req.body;

    const updated = await db('expert_profiles')
      .where({ user_id: userId })
      .update({
        name, photo_url, video_url,
        min_daily_rate, max_daily_rate,
        accept_incentive, available_remote,
        regions: regions || [],
        updated_at: db.fn.now(),
      })
      .returning('*');

    if (!updated.length) return res.status(404).json({ error: '프로필이 없습니다.' });
    const profile = await getFullProfile(userId);
    res.json(profile);
  } catch (err) {
    next(err);
  }
}

// GET /api/experts/:id
async function getExpertById(req, res, next) {
  try {
    const profile = await getFullProfile(req.params.id);
    if (!profile) return res.status(404).json({ error: '전문가를 찾을 수 없습니다.' });
    res.json(profile);
  } catch (err) {
    next(err);
  }
}

async function getFullProfile(userId) {
  const profile = await db('expert_profiles').where({ user_id: userId }).first();
  if (!profile) return null;

  const careers = await db('expert_careers').where({ expert_id: userId }).orderBy('start_year', 'desc');
  const tags = await db('expert_tags').where({ expert_id: userId });

  return { ...profile, careers, tags };
}

module.exports = { createProfile, getMyProfile, updateProfile, getExpertById };
