import { ComponentProps, forwardRef } from "react";
import { FormField } from "./FormField";
import { fieldBaseClasses } from "./styles";
import { Select } from "@/components/ui/Select";

type SelectFieldProps = ComponentProps<typeof Select> & {
  label: string;
  error?: string;
  required?: boolean;
};

export const SelectField = forwardRef<HTMLButtonElement, SelectFieldProps>(
  ({ label, error, id, className = "", required, children, ...props }, ref) => (
    <FormField label={label} htmlFor={id!} error={error} required={required}>
      {/* No native `required` attribute — see TextField for why. */}
      <Select ref={ref} id={id} className={`${fieldBaseClasses} pl-3 ${className}`} {...props}>
        {children}
      </Select>
    </FormField>
  )
);
SelectField.displayName = "SelectField";
