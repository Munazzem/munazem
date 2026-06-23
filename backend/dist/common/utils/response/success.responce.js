export const SuccessResponse = ({ res, message = "done", status = 200, data = undefined }) => {
    return res.status(status).json({ status, message, data });
};
//# sourceMappingURL=success.responce.js.map