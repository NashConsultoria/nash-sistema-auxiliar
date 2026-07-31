import "./Button.css";

export default function Button({ children, isIcon = false, onClick, ...props }) {
  return (
    <button 
      className={`btn ${isIcon ? "btn-icon" : ""}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </button>
  );
}