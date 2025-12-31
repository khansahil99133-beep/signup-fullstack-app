import React from "react";

export default function TextField(props: {
  label: string;
  placeholder?: string;
  type?: string;
  value: string;
  onChange: (v: string) => void;
  right?: React.ReactNode;
  autoComplete?: string;
  error?: string | null;
}) {
  const { label, placeholder, type = "text", value, onChange, right, autoComplete, error } = props;
  return (
    <label className="field">
      <div className="fieldLabelRow">
        <div className="fieldLabel">{label}</div>
        {error ? <div className="fieldErr">{error}</div> : null}
      </div>

      <div className={`fieldRow ${error ? "fieldRowErr" : ""}`}>
        <input
          className="fieldInput"
          type={type}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
        />
        {right ? <div className="fieldRight">{right}</div> : null}
      </div>
    </label>
  );
}
