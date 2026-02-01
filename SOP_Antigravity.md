# SOP: ETF Portfolio PWA & Smart PAC Manager

## 1. Visione del Progetto
Creare una PWA (Progressive Web App) per iPhone per monitorare un portafoglio ETF su Borsa Italiana e gestire un piano di accumulo (PAC) intelligente. L'interfaccia deve seguire lo stile dello screenshot fornito dall'utente.

## 2. Specifiche Tecniche
- **Framework:** React con Vite.
- **Styling:** Tailwind CSS (Mobile-first, stile iOS).
- **Librerie:** Recharts (grafici), Lucide React (icone), Vite-plugin-pwa.
- **Dati:** Leggi `tickers.json`. Prezzi tramite Yahoo Finance API (ticker .MI).

## 3. Logica del PAC (Smart Rebalancing)
- **Input:** Budget mensile + Cash residuo precedente.
- **Obiettivo:** Ribilanciare il portafoglio verso i target definiti nel JSON senza mai vendere asset.
- **Funzionamento:**
    1. Identifica l'ETF più sottopesato rispetto al `target_weight`.
    2. Calcola quante quote intere acquistare in base al prezzo EOD.
    3. Se avanza budget, passa al secondo asset più sottopesato.
    4. Salva l'avanzo (cash non sufficiente per una quota intera) come "Cash Residuo" per il mese successivo.

## 4. Visualizzazione Dati
- **Dashboard:** Valore totale, Profit/Loss (%), e ripartizione Bond/Equity.
- **Grafici:** - Stacked Bar Chart (Allocazione attuale vs Target).
    - Line Chart (Crescita storica del portafoglio).
- **Sezione PAC:** Input interattivo per il calcolo degli acquisti consigliati.

## 5. Istruzioni per l'Agente
- Analizza lo screenshot caricato per definire il tema (Colori, Radius, Shadow).
- Configura il manifest PWA per l'installazione su iOS (display: standalone).
- Assicurati che il ticker EXUS.MI punti correttamente all'ISIN IE0006WW1TQ4 e valuta i prezzi in Euro.
- Una volta completato, avvia `npm run dev` e mostra l'anteprima nel browser integrato.