import { Router } from 'express';
import multer from 'multer';
import * as items from '../controllers/itemsController';
import * as looks from '../controllers/looksController';
import * as wear from '../controllers/wearHistoryController';
import * as profile from '../controllers/profileController';
import * as insights from '../controllers/insightsController';
import * as suggestions from '../controllers/suggestionsController';
import { requireAuth } from '../middleware/auth';
import { asyncHandler } from '../middleware/error';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

export const apiRouter = Router();

apiRouter.use(asyncHandler(requireAuth));

// Closet
apiRouter.get('/items', asyncHandler(items.listItems));
apiRouter.post('/items/upload', upload.single('image'), asyncHandler(items.uploadItem));
apiRouter.get('/items/:id', asyncHandler(items.getItem));
apiRouter.patch('/items/:id', asyncHandler(items.updateItem));
apiRouter.delete('/items/:id', asyncHandler(items.deleteItem));

// Looks
apiRouter.get('/looks', asyncHandler(looks.listLooks));
apiRouter.post('/looks', asyncHandler(looks.createLook));
apiRouter.get('/looks/:id', asyncHandler(looks.getLook));
apiRouter.delete('/looks/:id', asyncHandler(looks.deleteLook));

// Calendar / wear history
apiRouter.get('/wear-history', asyncHandler(wear.listWearHistory));
apiRouter.post('/wear-history', asyncHandler(wear.logWear));
apiRouter.delete('/wear-history/:id', asyncHandler(wear.deleteWearEntry));

// Suggestions & feedback
apiRouter.get('/suggestions/daily', asyncHandler(suggestions.dailySuggestions));
apiRouter.post('/feedback', asyncHandler(suggestions.submitFeedback));

// Profile & insights
apiRouter.get('/profile', asyncHandler(profile.getProfile));
apiRouter.patch('/profile', asyncHandler(profile.updateProfile));
apiRouter.get('/insights/declutter', asyncHandler(insights.declutterInsights));
