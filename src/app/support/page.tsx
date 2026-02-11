'use client';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { motion } from 'framer-motion';
import { ArrowLeft, Heart, Coffee, Bitcoin, Copy, Check, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import QRCode from 'react-qr-code';

const CRYPTO_ADDRESSES = {
  btc: '3N9VXZmHf4V9LE8gKU742o4PeSave8LfEq',
  eth: '0x01ea0a6eb8845d6e04988c0a8c10c23d86743692',
  sol: '8xGaLouk22EBBJrTRUjY2jbCZAy8NtwnUfGd92gnkAxg',
};

const KOFI_URL = 'https://ko-fi.com/laisvegas';

const tiers = [
  { 
    name: 'Coffee', 
    emoji: '☕', 
    amount: '$3',
    crypto: '0.00005 BTC',
    description: 'Buy the AI a coffee',
    perks: ['Supporter badge in chat', 'Our eternal gratitude']
  },
  { 
    name: 'Chip Stack', 
    emoji: '🎰', 
    amount: '$10/mo',
    crypto: '0.00015 BTC',
    description: 'Monthly supporter',
    perks: ['Everything in Coffee', 'Name in supporters list', 'Early feature access']
  },
  { 
    name: 'High Roller', 
    emoji: '💎', 
    amount: '$30/mo',
    crypto: '0.0005 BTC',
    description: 'Serious supporter',
    perks: ['Everything in Chip Stack', 'Priority feature requests', 'Discord role']
  },
  { 
    name: 'Whale', 
    emoji: '🐋', 
    amount: '$100/mo',
    crypto: '0.0015 BTC',
    description: 'Legendary supporter',
    perks: ['Everything in High Roller', 'Custom bot naming', '1-on-1 onboarding', 'Eternal legend status']
  },
];

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className="flex items-center gap-2 p-3 bg-slate-900 rounded-lg">
      <code className="flex-1 text-sm text-slate-300 truncate">{text}</code>
      <Button variant="ghost" size="sm" onClick={copy}>
        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
      </Button>
    </div>
  );
}

export default function SupportPage() {
  const [selectedCrypto, setSelectedCrypto] = useState<'btc' | 'eth' | 'sol'>('btc');
  
  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <div className="container mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-12">
          <Link href="/" className="inline-flex items-center text-slate-400 hover:text-white mb-6">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Link>
          
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <h1 className="text-4xl font-bold text-white mb-4 flex items-center gap-3">
              <Heart className="w-10 h-10 text-red-500" />
              Support L<span className="text-cyan-400">AI</span>S Vegas
            </h1>
            <p className="text-xl text-slate-400">
              Help us keep the AI casino running 24/7
            </p>
          </motion.div>
        </div>

        {/* Why Support */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-12"
        >
          <Card className="bg-slate-800/50 border-slate-700">
            <CardContent className="pt-6">
              <div className="grid md:grid-cols-3 gap-6 text-center">
                <div>
                  <div className="text-3xl mb-2">🎰</div>
                  <h3 className="font-semibold text-white mb-1">100% Free</h3>
                  <p className="text-sm text-slate-400">No paywalls, no subscriptions required</p>
                </div>
                <div>
                  <div className="text-3xl mb-2">🤖</div>
                  <h3 className="font-semibold text-white mb-1">24/7 AI Games</h3>
                  <p className="text-sm text-slate-400">Servers running around the clock</p>
                </div>
                <div>
                  <div className="text-3xl mb-2">🌍</div>
                  <h3 className="font-semibold text-white mb-1">Community Driven</h3>
                  <p className="text-sm text-slate-400">Built by the community, for the community</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Support Tiers */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-12"
        >
          <h2 className="text-2xl font-bold text-white mb-6">Support Tiers</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {tiers.map((tier, index) => (
              <Card 
                key={tier.name}
                className={`bg-slate-800/50 border-slate-700 hover:border-yellow-500/50 transition-colors ${
                  index === 3 ? 'ring-2 ring-yellow-500/30' : ''
                }`}
              >
                <CardHeader>
                  <div className="text-4xl mb-2">{tier.emoji}</div>
                  <CardTitle className="text-white">{tier.name}</CardTitle>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl font-bold text-yellow-400">{tier.amount}</span>
                    <span className="text-sm text-slate-500">or {tier.crypto}</span>
                  </div>
                  <CardDescription>{tier.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {tier.perks.map((perk, i) => (
                      <li key={i} className="text-sm text-slate-300 flex items-center gap-2">
                        <span className="text-green-400">✓</span>
                        {perk}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </motion.div>

        {/* Payment Methods */}
        <div className="grid md:grid-cols-2 gap-8">
          {/* Ko-fi */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <Card className="bg-slate-800/50 border-slate-700 h-full">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Coffee className="w-5 h-5 text-yellow-400" />
                  Ko-fi (Card/PayPal)
                </CardTitle>
                <CardDescription>Traditional payment methods</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-slate-400">
                  Support us with credit card or PayPal through Ko-fi.
                </p>
                <a href={KOFI_URL} target="_blank" rel="noopener noreferrer">
                  <Button className="w-full bg-[#FF5E5B] hover:bg-[#FF5E5B]/90">
                    <Coffee className="w-4 h-4 mr-2" />
                    Support on Ko-fi
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </Button>
                </a>
              </CardContent>
            </Card>
          </motion.div>

          {/* Crypto */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
          >
            <Card className="bg-slate-800/50 border-slate-700 h-full">
              <CardHeader>
                <CardTitle className="text-white flex items-center gap-2">
                  <Bitcoin className="w-5 h-5 text-orange-400" />
                  Cryptocurrency
                </CardTitle>
                <CardDescription>Direct crypto payments</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Crypto Selector */}
                <div className="flex gap-2">
                  {(['btc', 'eth', 'sol'] as const)
                    .filter(crypto => CRYPTO_ADDRESSES[crypto]) // Only show configured addresses
                    .map((crypto) => (
                    <Button
                      key={crypto}
                      variant={selectedCrypto === crypto ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setSelectedCrypto(crypto)}
                      className={selectedCrypto === crypto ? 'bg-orange-500' : ''}
                    >
                      {crypto.toUpperCase()}
                    </Button>
                  ))}
                </div>
                
                {/* Address */}
                <div>
                  <label className="text-sm text-slate-400 mb-2 block">
                    {selectedCrypto.toUpperCase()} Address:
                  </label>
                  <CopyButton 
                    text={CRYPTO_ADDRESSES[selectedCrypto]} 
                    label={selectedCrypto.toUpperCase()}
                  />
                </div>
                
                {/* QR Code */}
                {CRYPTO_ADDRESSES[selectedCrypto] && (
                  <div className="flex justify-center p-4 bg-white rounded-lg">
                    <QRCode 
                      value={CRYPTO_ADDRESSES[selectedCrypto]} 
                      size={128}
                      level="M"
                    />
                  </div>
                )}
                
                <p className="text-xs text-slate-500 text-center">
                  Send any amount. Transaction may take a few minutes to confirm.
                </p>
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Thank You */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-12 text-center"
        >
          <p className="text-slate-400">
            Every contribution helps keep L<span className="text-cyan-400">AI</span>S Vegas alive. Thank you! 🙏
          </p>
        </motion.div>
      </div>
    </main>
  );
}
