import { useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import { Toast, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport } from "@/components/ui/toast";

export function Toaster() {
  const { toasts, dismiss } = useToast();
  const canDismissRef = useRef(false);

  // Dismiss all toasts when user clicks anywhere (after a delay to prevent immediate dismissal)
  useEffect(() => {
    const handleClick = () => {
      if (toasts.length > 0 && canDismissRef.current) {
        dismiss();
      }
    };

    // Add small delay before allowing dismissal to prevent the click that created the toast from dismissing it
    if (toasts.length > 0) {
      canDismissRef.current = false;
      const timer = setTimeout(() => {
        canDismissRef.current = true;
      }, 200);

      document.addEventListener('click', handleClick);
      
      return () => {
        clearTimeout(timer);
        document.removeEventListener('click', handleClick);
        canDismissRef.current = false;
      };
    }
  }, [toasts, dismiss]);

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, ...props }) {
        return (
          <Toast key={id} {...props}>
            <div className="grid gap-1">
              {title && <ToastTitle>{title}</ToastTitle>}
              {description && <ToastDescription>{description}</ToastDescription>}
            </div>
            {action}
            <ToastClose />
          </Toast>
        );
      })}
      <ToastViewport />
    </ToastProvider>
  );
}
