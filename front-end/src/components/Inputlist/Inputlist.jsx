import React from 'react';

export default function Inputlist({
  id,
  label,
  value = "",
  onChange,
  options = [],
  placeholder = "Digite para buscar...",
  disabled = false,
  required = false,
  className = "form-input",
  valueKey = "nome",
  keyProperty = "id",
  ...props
}) {
  const datalistId = `list-${id}`;

  const getValue = (item) => {
    if (typeof item !== 'object' || item === null) return item;
    if (typeof valueKey === 'function') return valueKey(item);
    return item[valueKey] || "";
  };

  return (
    <div className="form-group">
      {label && <label htmlFor={id} className="form-label">{label}</label>}
      
      <input
        id={id}
        type="text"
        list={datalistId}
        className={className}
        placeholder={placeholder}
        disabled={disabled}
        required={required}
        value={value}
        onChange={onChange}
        {...props}
      />

      <datalist id={datalistId}>
        {options.map((item, index) => {
          const val = getValue(item);
          const k = typeof item === 'object' ? item[keyProperty] || index : index;

          return <option key={k} value={val} />;
        })}
      </datalist>
    </div>
  );
}