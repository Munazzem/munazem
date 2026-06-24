import { Model, Document } from 'mongoose';
interface ICounter extends Document {
    key: string;
    count: number;
}
export declare const CounterModel: Model<ICounter>;
export declare function nextSequence(key: string): Promise<number>;
export {};
//# sourceMappingURL=counter.model.d.ts.map