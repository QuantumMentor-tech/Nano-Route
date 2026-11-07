import React from "react";
import { Dialog } from "./Dialog";
import { Button } from "../ui/Button";

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  maxWidth?: string | number;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isDestructive = false,
  isLoading = false,
  onConfirm,
  onCancel,
  maxWidth = "440px",
}) => {
  return (
    <Dialog
      isOpen={isOpen}
      onClose={isLoading ? () => {} : onCancel}
      title={title}
      maxWidth={maxWidth}
      closeOnOverlayClick={!isLoading}
      closeOnEscape={!isLoading}
      footer={
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={isDestructive ? "destructive" : "primary"}
            size="sm"
            onClick={onConfirm}
            isLoading={isLoading}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p style={{ margin: 0, fontSize: "0.875rem", color: "var(--nr-text-secondary)", lineHeight: 1.5 }}>
        {description}
      </p>
    </Dialog>
  );
};

ConfirmDialog.displayName = "ConfirmDialog";

