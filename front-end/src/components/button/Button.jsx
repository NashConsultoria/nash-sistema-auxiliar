import "./Button.css";

export default function Button({ 
  children, 
  variant = "primary", // 'primary' | 'toggle' | 'icon'
  active = false,       // Usado principalmente para a variante 'toggle'
  isIcon = false,       // Mantido para compatibilidade
  className = "", 
  onClick, 
  ...props 
}) {
  // Combinação de classes dinâmicas
  const variantClass = isIcon || variant === "icon" 
    ? "btn-icon" 
    : variant === "toggle" 
    ? `btn-toggle ${active ? "active" : ""}` 
    : "";

  return (
    <button 
      className={`btn ${variantClass} ${className}`.trim()}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
}