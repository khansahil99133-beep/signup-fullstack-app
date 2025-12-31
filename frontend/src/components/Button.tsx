import React from "react";

export default function Button(props: {
  children: React.ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  variant?: "primary" | "ghost";
}) {
  const { children, onClick, type = "button", disabled, variant = "primary" } = props;
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={variant === "primary" ? "btnPrimary" : "btnGhost"}
    >
      {children}
    </button>
  );
}
