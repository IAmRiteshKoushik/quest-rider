import { Router } from "express";
import { getAllCoursesAndEnrolled } from "../controllers/course.controller";
import { authenticate, requireRole } from "../middlewares/auth.middleware";

const router = Router();

router.get("/courses", authenticate, requireRole("STUDENT"), getAllCoursesAndEnrolled);

export { router as meRouter };
