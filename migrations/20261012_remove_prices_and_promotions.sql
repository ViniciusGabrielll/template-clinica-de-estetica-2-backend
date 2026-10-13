-- Remove preços e promoções do sistema.
-- Faça backup do banco antes de executar: estes campos e registros serão removidos.
ALTER TABLE services DROP COLUMN price;
ALTER TABLE appointments DROP COLUMN original_total_price;
ALTER TABLE appointments DROP COLUMN total_price;
DROP TABLE IF EXISTS promotions;
