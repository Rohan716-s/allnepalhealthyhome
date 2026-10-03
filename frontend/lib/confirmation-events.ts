export type ConfirmationRequest = {
  title: string;
  message: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  checkboxLabel?: string;
  inputLabel?: string;
  inputPlaceholder?: string;
  inputRequired?: boolean;
  tone?: "default" | "danger";
  onConfirm?: (checked: boolean, inputValue?: string) => void | Promise<void>;
};

export function requestSiteConfirmation(request: ConfirmationRequest) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ConfirmationRequest>("anhh:confirmation-request", { detail: request }));
}
