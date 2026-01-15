import { Router } from "express";
import { getAllCoursesAndEnrolled } from "../controllers/course.controller";
import { authenticate } from "../middlewares/auth.middleware";

const router = Router();

router.get("/courses", authenticate, getAllCoursesAndEnrolled);

export { router as meRouter };
