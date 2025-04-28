import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Method not allowed' });
  }

  const { address } = req.body;

  if (!address) {
    return res.status(400).json({ message: 'Wallet address is required' });
  }

  try {
    const covalentRes = await fetch(`https://api.covalenthq.com/v1/1/address/${address}/balances_v2/?key=${process.env.COVALENT_API_KEY}`);
    const covalentData = await covalentRes.json();

    if (!covalentData.data || !covalentData.data.items) {
      return res.status(500).json({ message: 'Failed to fetch wallet data' });
    }

    const assets = covalentData.data.items.map(item => \`\${item.contract_ticker_symbol}: \${item.balance / Math.pow(10, item.contract_decimals)}\`).join(', ');

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: '你是一个专业的Web3钱包资产分析师。' },
          { role: 'user', content: `以下是我的钱包资产情况：${assets}。请你帮我分析这个钱包的特点和可能属于什么类型的用户？` }
        ]
      })
    });

    const openaiData = await openaiRes.json();

    if (openaiData.error) {
      console.error('OpenAI API error:', openaiData.error);
      return res.status(500).json({ message: 'Failed to analyze wallet', detail: openaiData.error });
    }

    res.status(200).json({ assets: covalentData.data.items, analysis: openaiData.choices[0].message.content });

  } catch (error) {
    console.error('Server error:', error);
    res.status(500).json({ message: 'Internal Server Error', error: error.message });
  }
}
