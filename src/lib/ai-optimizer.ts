import { GoogleGenerativeAI } from '@google/generative-ai';

export interface OptimizationResult {
  title: string;
  description: string;
  keywords: string[];
}

const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';

/**
 * Generate a basic fallback when Gemini is unavailable or unconfigured.
 */
function getFallback(data: any): OptimizationResult {
  return {
    title: `Premium ${data.origin || ''} ${data.beanVariety || ''} Coffee Beans`.trim(),
    description: `High quality ${data.roastLevel || ''} coffee from ${data.origin || ''}.`.trim(),
    keywords: ['coffee', 'wholesale', 'roasted coffee beans'],
  };
}

export async function optimizeProduct(data: any, variation: boolean = false): Promise<OptimizationResult> {
  // Skip Gemini entirely if no API key is configured
  if (!GEMINI_API_KEY) {
    console.log('⏭️  Gemini API key not set — using fallback content.');
    return getFallback(data);
  }

  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

  const prompt = `
    You are a professional B2B E-commerce expert specializing in Alibaba.com.
    Optimize the following coffee product for wholesale buyers.
    
    Product Data:
    - Origin: ${data.origin}
    - Variety: ${data.beanVariety}
    - Roast: ${data.roastLevel}
    - Processing: ${data.processing}
    - Target: B2B Wholesale
    ${variation ? '- Variation Mode: Focus on a specific USP (e.g., sustainability, freshness, or price) to make this listing unique from previous days.' : ''}

    Output JSON format only:
    {
      "title": "SEO optimized title (max 128 chars)",
      "description": "Professional detailed description with bullet points",
      "keywords": ["5-7 relevant keywords"]
    }
  `;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    
    // Extract JSON from the response (sometimes AI wraps it in markdown blocks)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    throw new Error('Failed to parse AI response');
  } catch (error) {
    console.error('Gemini Optimization Error:', error);
    // Fallback if API fails
    return getFallback(data);
  }
}
