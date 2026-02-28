# SPECIFICHE DI REFACTORING: ETF TRACKER (PWA iOS) - ARCHITETTURA ANTIFRAGILE

## 1. Architettura dei Dati (Isolamento dei Vault)
L'applicazione deve gestire il capitale separandolo in due compartimenti stagni. Il calcolo delle percentuali del portafoglio d'investimento non deve MAI includere il fondo di emergenza.

* **Vault A (Cuscinetto di Sopravvivenza):**
    * Asset: `XEON` (Liquidità monetaria).
    * Funzione: Solo tracciamento visivo del controvalore assoluto (€).
    * Vincolo: Escluso dal totale del portafoglio e da qualsiasi calcolo di ribilanciamento.

* **Vault B (Portafoglio Investito "Barbell"):**
    * Contiene i 6 ETF operativi.
    * Il "Capitale Totale" per i calcoli logici corrisponde esclusivamente alla somma del controvalore (Prezzo x Quote) di questi 6 asset.

## 2. Asset Allocation Target e Soglie Asimmetriche
L'applicazione deve basarsi sulle seguenti costanti hardcoded per il Vault B. Le soglie di vendita (bande di tolleranza) sono asimmetriche: larghe per l'azionario (per far correre l'interesse composto), strette per le coperture (per iniettare liquidità durante i crolli).

| Ticker | Categoria | Target Teorico (%) | Soglia Massima Vendita (%) |
| :--- | :--- | :--- | :--- |
| **XDPU** | Azionario USA | 35.0 | > 45.0 |
| **EXUS** | Azionario Sviluppati | 28.0 | > 36.0 |
| **EIMI** | Azionario Emergenti | 7.0 | > 11.0 |
| **C3M** | Monetario (Polvere da sparo) | 10.0 | > 13.0 |
| **X25E** | Obbligazionario 25+ (Deflazione) | 10.0 | > 13.0 |
| **IBCI** | Inflation-Linked (Inflazione) | 10.0 | > 13.0 |

## 3. Logica Algoritmica 1: PAC Mensile (L'Inerzia)
Questo è il motore di default dell'app, visibile nella dashboard principale.
* **Obiettivo:** Indicare in modo binario all'utente quale singolo ETF acquistare con il flusso di cassa mensile.
* **Calcolo:** 1. Calcolare il `Peso Reale (%)` attuale di ogni ETF nel Vault B.
    2. Calcolare la `Deviazione dal Target` per ogni ETF: `Target Teorico (%) - Peso Reale (%)`.
* **Output UI:** L'ETF che restituisce il valore positivo più alto (quello matematicamente più "indietro") deve essere evidenziato a schermo intero come **"Acquisto Mensile Consigliato"**.

## 4. Logica Algoritmica 2: La Tagliola Annuale (Il Ribilanciamento)
Questo modulo deve essere idealmente nascosto dietro un toggle o una vista separata ("Check-up Annuale") per evitare di indurre l'utente a fare *overtrading*.
* **Obiettivo:** Intercettare le derive strutturali ed estrarre liquidità dai picchi di volatilità.
* **Calcolo:**
    1. L'algoritmo verifica per ogni ETF la condizione: `Peso Reale (%) > Soglia Massima Vendita (%)`.
    2. Se l'array restituisce solo `FALSE`, l'UI mostra: *"Nessun intervento richiesto"*.
    3. Se un asset restituisce `TRUE`, l'UI attiva un "Allarme Ribilanciamento" (es. alert rosso).
* **Output UI (Chirurgico):** Per l'asset in violazione, l'app deve calcolare e mostrare istantaneamente l'esatto importo in Euro da liquidare per riportarlo al suo target originario:
    * `Eccedenza (%) = Peso Reale (%) - Target Teorico (%)`
    * `Capitale da Vendere (€) = Eccedenza (%) * Capitale Totale Vault B (€)`

## 5. Requisiti di Resilienza Tecnica (Specifici per iOS PWA)
* **Persistenza Dati:** Safari su iOS elimina il `localStorage` dopo alcuni giorni di inattività. L'app deve utilizzare `IndexedDB` o implementare una funzione rapida per esportare/importare un file JSON con i log delle transazioni e i target.
* **Fallback API:** Se l'API dei prezzi (es. Yahoo Finance) ritarda o fallisce la chiamata, l'app deve permettere un input manuale o utilizzare l'ultimo prezzo salvato in cache per non bloccare il calcolo mensile del PAC.
* **Safe Area & UI:** Il CSS deve includere `padding: env(safe-area-inset-top)` e blocco dello zoom involontario sugli input (`font-size: 16px`) per rispettare le policy WebKit di iOS.