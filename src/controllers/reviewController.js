const db = require('../config/database');

// POST /api/contracts/:id/reviews
async function createReview(req, res, next) {
  try {
    const contract = await db('contracts')
      .where({ id: req.params.id, status: 'completed' })
      .first();
    if (!contract) {
      return res.status(404).json({ error: '완료된 계약을 찾을 수 없습니다.' });
    }

    const reviewerId = req.user.id;
    if (reviewerId !== contract.client_id && reviewerId !== contract.expert_id) {
      return res.status(403).json({ error: '권한이 없습니다.' });
    }

    const revieweeId = reviewerId === contract.client_id ? contract.expert_id : contract.client_id;

    const existing = await db('reviews')
      .where({ contract_id: contract.id, reviewer_id: reviewerId })
      .first();
    if (existing) {
      return res.status(409).json({ error: '이미 평가를 작성하셨습니다.' });
    }

    const { rating, comment } = req.body;
    if (rating < 1 || rating > 5) {
      return res.status(400).json({ error: '평점은 1~5 사이여야 합니다.' });
    }

    const [review] = await db('reviews')
      .insert({
        contract_id: contract.id,
        reviewer_id: reviewerId,
        reviewee_id: revieweeId,
        rating,
        comment,
      })
      .returning('*');

    // Expert가 평가 대상인 경우 평균 평점 업데이트
    if (revieweeId === contract.expert_id) {
      const { avg } = await db('reviews')
        .where({ reviewee_id: revieweeId })
        .avg('rating as avg')
        .first();
      await db('expert_profiles')
        .where({ user_id: revieweeId })
        .update({ rating_avg: parseFloat(avg).toFixed(2) });
    }

    res.status(201).json(review);
  } catch (err) {
    next(err);
  }
}

// GET /api/experts/:id/reviews
async function getExpertReviews(req, res, next) {
  try {
    const reviews = await db('reviews')
      .where({ reviewee_id: req.params.id })
      .orderBy('created_at', 'desc');
    res.json(reviews);
  } catch (err) {
    next(err);
  }
}

module.exports = { createReview, getExpertReviews };
