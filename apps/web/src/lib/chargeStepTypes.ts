/**
 * Shared type definitions for ChargeStep, mirroring the API evaluator's types.
 * Kept in a separate file so ChargeStepsEditor.tsx and its tests can import
 * from a stable location without circular dependencies.
 */

export type ConditionCmp = "is" | "is not" | ">" | "<" | ">=" | "<=";

export interface Condition {
  field: string;
  cmp: ConditionCmp;
  value: string | number;
}

export interface StartStep {
  op: "start";
  field: string | number;
}

export interface MultiplyStep {
  op: "multiply";
  field: string | number;
  when?: Condition;
}

export interface DivideStep {
  op: "divide";
  field: string | number;
  when?: Condition;
}

export interface AddStep {
  op: "add";
  field: string | number;
  when?: Condition;
}

export interface SubtractStep {
  op: "subtract";
  field: string | number;
  when?: Condition;
}

export interface RoundStep {
  op: "round";
  direction: "nearest" | "up" | "down";
  interval: number;
}

export interface FloorStep {
  op: "floor";
  value: number;
  when?: Condition;
}

export interface CapStep {
  op: "cap";
  value: number;
  when?: Condition;
}

export type ChargeStep =
  | StartStep
  | MultiplyStep
  | DivideStep
  | AddStep
  | SubtractStep
  | RoundStep
  | FloorStep
  | CapStep;
