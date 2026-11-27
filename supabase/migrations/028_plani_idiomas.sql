-- La plani en el idioma de cada atleta: traducciones del WOD (inglés, francés y polaco)
-- { "h": huella del texto en español, "en": {title, description, ...}, "fr": {...}, "pl": {...} }
-- Las escribe solo el servidor; si el coach cambia el texto, se vuelve a traducir. Aditivo.
alter table public.wods add column if not exists i18n jsonb;
