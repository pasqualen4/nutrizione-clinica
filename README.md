# Nutrizione Clinica · Frontend generatore dieta v2

Frontend standalone collegato al progetto Supabase `Nutrizione Clinica`.

## Funzioni incluse
- login nutrizionista con Supabase Auth
- selezione paziente
- caricamento ultima visita e ultima BIA
- target kcal / macro / fibra / sodio
- calcolo rapido macro da percentuali
- distribuzione energetica per pasto
- pattern onnivoro / vegetariano / vegano
- allergie, esclusioni, preferenze e note
- frequenze settimanali avanzate
- chiamata alla Edge Function `generate-diet-plan`
- Quality Score e warning giornalieri
- dettaglio 7 giorni, pasti e nutrienti
- equivalenze alimentari
- Edge Function `regenerate-diet-day` per rigenerare un solo giorno
- pubblicazione del piano al paziente
- storico dei piani del paziente

## Avvio
Servire la cartella con un web server statico (non aprire semplicemente `file://` per evitare limitazioni del browser sui moduli ES).

Esempio:
```bash
python3 -m http.server 8080
```
quindi aprire `http://localhost:8080`.

## Nota sul deploy
La Site projection `nutrizione-clinica.pasqualen4.chatgpt.site` non espone il sorgente come file modificabile dalla Library. Questo pacchetto è pronto per essere usato come sorgente sostitutivo o integrato nel progetto frontend originale quando disponibile.
