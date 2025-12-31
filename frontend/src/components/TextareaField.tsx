import React from "react";

export default function TextareaField(props: {
  label: string;
  placeholder?: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  error?: string | null;
}) {
  const { label, placeholder, value, onChange, rows = 4, error } = props;
  return (
    <label className="field">
      <div className="fieldLabelRow">
        <div className="fieldLabel">{label}</div>
        {error ? <div className="fieldErr">{error}</div> : null}
      </div>

      <div className={`fieldRow ${error ? "fieldRowErr" : ""}`}>
        <textarea
          className="fieldTextarea"
          placeholder={placeholder}
          value={value}
          rows={rows}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </label>
  );
}
