import type { ComponentProps } from "react";

export function Button({ className = "", ...props }: ComponentProps<"button">) {
  return <button className={`button ${className}`} {...props} />;
}
export function Field({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={`text-input ${className}`} {...props} />;
}
export function StatusLabel({
  className = "",
  ...props
}: ComponentProps<"span">) {
  return <span className={`status-pill ${className}`} {...props} />;
}
export function Card({ className = "", ...props }: ComponentProps<"section">) {
  return <section className={`panel ${className}`} {...props} />;
}
export function Table({ className = "", ...props }: ComponentProps<"table">) {
  return (
    <div className="table-scroll">
      <table className={`data-table ${className}`} {...props} />
    </div>
  );
}
