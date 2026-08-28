import { evaluateExtractedText } from './book-processing.service';

describe('evaluateExtractedText', () => {
  it('aceita prosa portuguesa plausível', () => {
    const text = [
      'Quando chegou à cidade, Maria percebeu que as ruas estavam silenciosas.',
      'Ela caminhou até a praça e encontrou os amigos que esperavam por ela.',
      'Depois, todos seguiram para casa enquanto a chuva começava devagar.',
    ].join(' ');

    const result = evaluateExtractedText(text);

    expect(result.lowQuality).toBe(false);
    expect(result.score).toBeGreaterThanOrEqual(0.58);
  });

  it('não rejeita uma página válida somente por estar em maiúsculas', () => {
    const text = [
      'CAPÍTULO PRIMEIRO',
      'ESTA É UMA HISTÓRIA SOBRE UMA CIDADE ONDE AS PESSOAS VIVIAM ENTRE O MAR E AS MONTANHAS.',
      'TODOS OS DIAS, ELAS CAMINHAVAM PELAS RUAS E CONVERSAVAM SOBRE A VIDA.',
    ].join(' ');

    const result = evaluateExtractedText(text);

    expect(result.metrics.uppercaseWordRatio).toBeGreaterThan(0.7);
    expect(result.lowQuality).toBe(false);
  });

  it('solicita OCR para texto curto', () => {
    const result = evaluateExtractedText('Texto curto.');

    expect(result.lowQuality).toBe(true);
    expect(result.reasons).toContain('texto curto');
  });

  it('rejeita texto com caracteres de substituição e símbolos incomuns', () => {
    const text = 'A�b�c� §¤§¤§¤ xqtrplm zzzzzzz @@@@ conteúdo aparentemente longo '.repeat(8);

    const result = evaluateExtractedText(text);

    expect(result.lowQuality).toBe(true);
    expect(result.reasons).toContain('caracteres de substituição');
  });

  it('rejeita extração longa com palavras e sequências improváveis', () => {
    const text = 'xqtrplmnb vcxzqwrts plmnbvcxz qqqqqztrp kkkkrtpsm zxcvbnmlkj '.repeat(30);

    const result = evaluateExtractedText(text);

    expect(result.lowQuality).toBe(true);
    expect(result.metrics.improbableWordRatio).toBeGreaterThan(0.25);
    expect(result.reasons).toContain('sequências de letras improváveis');
  });

  it('rejeita texto longo plausível na forma, mas sem vocabulário português reconhecível', () => {
    const text = 'mave turo pinale rofena bulato zimera calivo denura faleto gupira '.repeat(10);

    const result = evaluateExtractedText(text);

    expect(result.metrics.plausibleWordRatio).toBeGreaterThan(0.9);
    expect(result.metrics.portugueseWordRatio).toBe(0);
    expect(result.lowQuality).toBe(true);
    expect(result.reasons).toContain('poucas palavras reconhecíveis em português');
  });
});
