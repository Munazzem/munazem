// ─── Shared job payload types for the WhatsApp queue ─────────────────────────
// All job variants share the base fields.  The `kind` discriminant lets the
// processor render the correct Arabic message without re-fetching the DB.
// `teacherId` identifies which teacher's WhatsApp client should send the message.
export {};
//# sourceMappingURL=queue.types.js.map