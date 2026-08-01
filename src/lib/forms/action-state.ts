export interface ActionState {
  status?: "error" | "success";
  message?: string;
  fieldErrors?: Record<string, string[]>;
  link?: {
    href: string;
    label: string;
  };
}

export const initialActionState: ActionState = {};
