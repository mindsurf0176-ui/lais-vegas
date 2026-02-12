import { NextRequest, NextResponse } from 'next/server';

// Simple language detection based on character ranges
function detectLanguage(text: string): string {
  const sample = text.slice(0, 200);
  
  // Korean
  if (/[\uAC00-\uD7AF]/.test(sample)) return 'ko';
  // Japanese (Hiragana, Katakana, Kanji)
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(sample) && !/[\uAC00-\uD7AF]/.test(sample)) return 'ja';
  // Chinese (if has CJK but no Japanese kana)
  if (/[\u4E00-\u9FFF]/.test(sample) && !/[\u3040-\u309F\u30A0-\u30FF]/.test(sample)) return 'zh';
  
  return 'en';
}

// POST /api/translate - Translate text
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, targetLang, sourceLang } = body;

    if (!text || !targetLang) {
      return NextResponse.json(
        { error: 'Missing text or targetLang' },
        { status: 400 }
      );
    }

    const detectedLang = sourceLang || detectLanguage(text);
    
    // If same language, return original
    if (detectedLang === targetLang) {
      return NextResponse.json({ 
        translatedText: text, 
        sourceLang: detectedLang,
        cached: false 
      });
    }

    // Try DeepL first (if API key exists)
    const deeplKey = process.env.DEEPL_API_KEY;
    if (deeplKey) {
      try {
        const deeplRes = await fetch('https://api-free.deepl.com/v2/translate', {
          method: 'POST',
          headers: {
            'Authorization': `DeepL-Auth-Key ${deeplKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: [text],
            target_lang: targetLang.toUpperCase(),
            source_lang: detectedLang.toUpperCase(),
          }),
        });

        if (deeplRes.ok) {
          const data = await deeplRes.json();
          return NextResponse.json({
            translatedText: data.translations[0].text,
            sourceLang: detectedLang,
            provider: 'deepl',
          });
        }
      } catch (e) {
        console.error('DeepL error:', e);
      }
    }

    // Fallback: LibreTranslate (free, no key needed for some instances)
    try {
      const libreRes = await fetch('https://libretranslate.com/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          q: text,
          source: detectedLang,
          target: targetLang,
          format: 'text',
        }),
      });

      if (libreRes.ok) {
        const data = await libreRes.json();
        return NextResponse.json({
          translatedText: data.translatedText,
          sourceLang: detectedLang,
          provider: 'libretranslate',
        });
      }
    } catch (e) {
      console.error('LibreTranslate error:', e);
    }

    // If all fails, return original with flag
    return NextResponse.json({
      translatedText: text,
      sourceLang: detectedLang,
      error: 'Translation unavailable',
      fallback: true,
    });

  } catch (err) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

// GET /api/translate/detect - Just detect language
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const text = searchParams.get('text');

  if (!text) {
    return NextResponse.json({ error: 'Missing text' }, { status: 400 });
  }

  const language = detectLanguage(text);
  return NextResponse.json({ language });
}
