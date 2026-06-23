export declare class PasswordUtil {
    private static readonly SALT_ROUNDS;
    static hashPassword(password: string): Promise<string>;
    static comparePassword(password: string, hash: string): Promise<boolean>;
}
//# sourceMappingURL=password.util.d.ts.map