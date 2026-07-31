import AppRoutes from "./routes/AppRoutes";
import { AuthProvider } from "./context/AuthContext";
import { PrintProvider } from "./context/PrintContext";

export default function App() {
    return (
        <AuthProvider>
            <PrintProvider>
                <AppRoutes />
            </PrintProvider>
        </AuthProvider>
    );
}