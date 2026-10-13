import type { ComponentProps } from "react";

export function Button({ className = "", ...props }: ComponentProps<"button">) {
  return <button className={`button ${className}`} {...props} />;
}
export function Field({ className = "", ...props }: ComponentProps<"input">) {
  return <input className={`text-input ${className}`} {...props} />;
}
export function SearchField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="list-search">
      <input
        type="search"
        aria-label={label}
        placeholder={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      />
      {value && (
        <button
          type="button"
          className="text-button"
          onClick={() => onChange("")}
        >
          Clear search
        </button>
      )}
    </div>
  );
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
