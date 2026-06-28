import type { InputHTMLAttributes } from "react";

type TextFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> & {
  label: string;
  onChange: (value: string) => void;
  value: string;
};

export function TextField({ label, onChange, value, ...props }: TextFieldProps) {
  return (
    <label className="field">
      <span>{label}</span>
      <input {...props} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}
