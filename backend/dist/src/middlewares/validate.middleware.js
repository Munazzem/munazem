import { ZodError } from 'zod';
import { BadRequestException } from '../common/utils/response/error.responce.js';
export const validate = (schema) => {
    return async (req, res, next) => {
        try {
            await schema.parseAsync({
                body: req.body,
                query: req.query,
                params: req.params,
            });
            next();
        }
        catch (error) {
            if (error instanceof ZodError) {
                // Collect all error messages from Zod
                const errorMessage = error.issues.map((err) => err.message).join(', ');
                // Pass the error to the global error handler
                return next(BadRequestException({ message: errorMessage, extra: error.issues }));
            }
            next(error);
        }
    };
};
//# sourceMappingURL=validate.middleware.js.map