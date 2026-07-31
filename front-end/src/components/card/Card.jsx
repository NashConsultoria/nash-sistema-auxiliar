import "./Card.css";

export default function Card({ title, children, actions }) {
    
    return (
        <div className="card">
            {title && (
                <div className="card-header">
                    <h1>{title}</h1>
                    {actions && <div className="card-actions">{actions}</div>}
                </div>
            )}
            <div className="card-body">
                {children}
            </div>
        </div>
    );
}