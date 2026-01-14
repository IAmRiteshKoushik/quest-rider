import { Router } from 'express';
import { login, logout, refresh, register, resendOtp, session, verifyOtp} from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth.middleware';
const router = Router();

router.post('/register', register)
router.post('/verify-otp', verifyOtp);
router.post('/resend-otp', resendOtp);
router.post('/login', login);
router.post('/refresh', refresh);   
// Protected routes
router.post('/logout', authenticate, logout);
router.get('/session', authenticate, session);

export { router as authRouter };