import { type ZodType } from "zod";
import { throwError } from "./errorFunction";

export function handleValidation<T>(
    schema: ZodType<T>,
    data: unknown,
    context: string
): T | never {
    const result = schema.safeParse(data);

    if (!result.success) {
        const errorJson: Record<string, string> = {};
        result.error.issues.forEach((issue) => {
            const field = issue.path.join(".");
            errorJson[field] = issue.message;
        });
        return throwError(400, "Invalid request data", context, errorJson);
    }

    return result.data;
}
