import { useEffect, useState } from "react"
import Button from "../components/button/Button"

export default function SimulatorPage() {


    
    return(
        <div>
            <h1>Simulator</h1>
            <Button onClick={() => window.print()}>
                Imprimir
            </Button>
        </div>
    )
}
