interface FallbackResponse {
  message: string;
  suggestions?: string[];
  resources?: string[];
  sentiment: 'supportive' | 'cautious' | 'celebratory' | 'concerned';
  showWarning: boolean;
}

interface ProgressBasedResponses {
  low: FallbackResponse;    // 0-33% progress
  medium: FallbackResponse;  // 34-66% progress  
  high: FallbackResponse;    // 67-99% progress
  complete: FallbackResponse; // 100% progress
}

const withdrawalResponses: Record<string, ProgressBasedResponses> = {
  gambling: {
    low: {
      message: "I understand the urge to gamble can be strong. You've just started this savings journey - what if we found a different way to get that excitement? Maybe a free mobile game or a walk could help with the feeling?",
      suggestions: [
        "Call a friend instead of gambling",
        "Set a 24-hour cooling-off period",
        "Calculate what this money could become in 6 months"
      ],
      resources: [
        "National Problem Gambling Helpline: 1-800-522-4700",
        "Gamblers Anonymous: www.gamblersanonymous.org",
        "NCPG Text Support: Text 'GAM' to 1-800-522-4700"
      ],
      sentiment: 'concerned',
      showWarning: true
    },
    medium: {
      message: "You've worked hard to save this much - that takes real discipline! Gambling might feel like a quick win, but your savings are a guaranteed win. Would you consider waiting 24 hours before deciding?",
      suggestions: [
        "Write down why you started saving",
        "Calculate the odds vs. your guaranteed savings",
        "Find a free activity for entertainment tonight"
      ],
      resources: [
        "National Problem Gambling Helpline: 1-800-522-4700",
        "Self-exclusion programs available at most casinos",
        "Free counseling at www.ncpgambling.org"
      ],
      sentiment: 'concerned',
      showWarning: true
    },
    high: {
      message: "You're so close to your goal! You've shown incredible self-control to save this much. Gambling could erase months of progress in minutes. Your future self will thank you for staying strong today. What originally motivated you to save?",
      suggestions: [
        "You're in the home stretch - don't give up now!",
        "Consider blocking gambling sites/apps",
        "Reward yourself with something small and non-financial"
      ],
      resources: [
        "National Problem Gambling Helpline: 1-800-522-4700",
        "Gambling blocking software: GamBan, BetBlocker",
        "Success stories: www.gamblersanonymous.org/ga/content/new-life-stories"
      ],
      sentiment: 'concerned',
      showWarning: true
    },
    complete: {
      message: "Congratulations on reaching your goal! You've proven you can achieve what you set out to do. Before using this for gambling, consider: could this be the seed money for your next goal? Your discipline got you here - it can take you even further.",
      suggestions: [
        "Set aside a small celebration amount instead",
        "Start a new goal with these funds",
        "Invest in yourself - a course or skill"
      ],
      resources: [
        "Investment basics: www.investor.gov",
        "National Problem Gambling Helpline: 1-800-522-4700",
        "Financial planning resources: www.mymoney.gov"
      ],
      sentiment: 'cautious',
      showWarning: true
    }
  },
  
  emergency: {
    low: {
      message: "Emergencies happen, and it's stressful when they do. Before withdrawing, have you explored all options? Sometimes payment plans or community resources can help preserve your savings momentum.",
      suggestions: [
        "Ask if payment plans are available",
        "Check local community assistance programs",
        "Consider if this is urgent or important"
      ],
      resources: [
        "211.org - Local emergency assistance",
        "www.usa.gov/benefits - Government programs",
        "www.modestneeds.org - Small emergency grants"
      ],
      sentiment: 'supportive',
      showWarning: false
    },
    medium: {
      message: "I understand this feels urgent. You've built up a good savings cushion - that's what it's for in true emergencies. Before withdrawing, let's make sure this is the only option. Have you checked if there are payment plans or assistance available?",
      suggestions: [
        "Negotiate a payment plan first",
        "Withdraw only what's absolutely necessary",
        "Look into 0% interest credit cards for true emergencies"
      ],
      resources: [
        "www.211.org - Crisis assistance",
        "www.needhelppayingbills.com - Bill payment help",
        "Local churches and charities often help with emergencies"
      ],
      sentiment: 'supportive',
      showWarning: false
    },
    high: {
      message: "You're so close to your goal! If this is a true emergency, your savings are here for you. But consider withdrawing only what you absolutely need. Could you handle this emergency with a smaller withdrawal and keep some progress?",
      suggestions: [
        "Calculate the minimum amount needed",
        "Keep at least 50% of your savings if possible",
        "Plan how to rebuild after the emergency"
      ],
      resources: [
        "Emergency budgeting guide: www.consumer.gov",
        "www.211.org - Emergency resources",
        "Credit counseling: www.nfcc.org"
      ],
      sentiment: 'supportive',
      showWarning: false
    },
    complete: {
      message: "You've reached your savings goal - well done! If this emergency is real and urgent, you've prepared for exactly this moment. Consider if you can solve it with partial funds and keep some savings as your new emergency fund.",
      suggestions: [
        "Use only what's needed for the emergency",
        "Keep an emergency fund for the future",
        "Document this for insurance if applicable"
      ],
      resources: [
        "FEMA disaster assistance: www.disasterassistance.gov",
        "Red Cross emergency assistance: www.redcross.org",
        "www.benefits.gov - Federal benefit finder"
      ],
      sentiment: 'supportive',
      showWarning: false
    }
  },
  
  'changed-mind': {
    low: {
      message: "It's normal to have doubts when starting something new. You've taken the first step, which is often the hardest. What if you adjusted your goal instead of abandoning it? Even small savings add up over time.",
      suggestions: [
        "Reduce your goal amount instead of quitting",
        "Take a break but keep the money saved",
        "Remember why you started"
      ],
      resources: [
        "Motivation tips: www.mint.com/blog",
        "r/personalfinance - Community support",
        "Small wins matter: www.thebalance.com"
      ],
      sentiment: 'supportive',
      showWarning: false
    },
    medium: {
      message: "You've come this far - that's not easy! Saving fatigue is real, but you've already proven you can do this. What originally motivated you? Sometimes we need to reconnect with our 'why' to push through the middle stretch.",
      suggestions: [
        "Write down what you'll feel when you reach the goal",
        "Calculate how many days of work this represents",
        "Visualize what achieving this goal means"
      ],
      resources: [
        "Goal setting strategies: www.mindtools.com",
        "Financial motivation: www.daveramsey.com",
        "Success stories: www.thepennyhoarder.com"
      ],
      sentiment: 'supportive',
      showWarning: false
    },
    high: {
      message: "You're in the final stretch! It would be heartbreaking to stop now when you're so close. You've already done the hard work. Can you imagine how proud you'll feel in just a few more weeks when you hit that target?",
      suggestions: [
        "You're 90% there - don't quit at the finish line!",
        "Take a photo of your progress to remember this moment",
        "Reward yourself (non-financially) for getting this far"
      ],
      resources: [
        "The psychology of quitting: www.psychologytoday.com",
        "Finishing strong: www.success.com",
        "Celebrating milestones: www.lifehack.org"
      ],
      sentiment: 'supportive',
      showWarning: true
    },
    complete: {
      message: "You did it! You reached your goal! That took real commitment. Before withdrawing, take a moment to appreciate what you've accomplished. This money represents your discipline and dedication. What's your next adventure?",
      suggestions: [
        "Celebrate without spending it all",
        "Set an even bigger goal",
        "Use this as your emergency fund base"
      ],
      resources: [
        "Next-level goals: www.nerdwallet.com",
        "Investment basics: www.investopedia.com",
        "Financial independence: www.mrmoneymustache.com"
      ],
      sentiment: 'celebratory',
      showWarning: false
    }
  },
  
  achieved: {
    low: {
      message: "Every savings journey starts somewhere, and you've begun yours! Even this amount is an achievement worth celebrating. Well done on taking the first steps!",
      suggestions: [
        "Celebrate this milestone",
        "Set your next goal 10% higher",
        "Share your success with someone supportive"
      ],
      resources: [
        "Building wealth: www.richdad.com",
        "Next steps: www.personalfinance.com",
        "Compound interest calculator: www.investor.gov"
      ],
      sentiment: 'celebratory',
      showWarning: false
    },
    medium: {
      message: "Fantastic work reaching your goal! You've proven you have the discipline to save. This is a significant achievement. How will you use this success to build even more financial security?",
      suggestions: [
        "Take 10% to celebrate, save the rest",
        "Start an investment account",
        "Double down with a bigger goal"
      ],
      resources: [
        "Beginner investing: www.bogleheads.org",
        "High-yield savings: www.bankrate.com",
        "Financial milestones: www.financialsamurai.com"
      ],
      sentiment: 'celebratory',
      showWarning: false
    },
    high: {
      message: "Outstanding achievement! You've not only reached but exceeded your initial expectations. This level of savings discipline is rare. You're ready for the next level of financial success!",
      suggestions: [
        "Consider keeping 50% for future goals",
        "Explore investment opportunities",
        "Teach others your savings strategy"
      ],
      resources: [
        "Index fund investing: www.vanguard.com",
        "FIRE movement: www.reddit.com/r/financialindependence",
        "Tax-advantaged accounts: www.irs.gov"
      ],
      sentiment: 'celebratory',
      showWarning: false
    },
    complete: {
      message: "🎉 Congratulations! You've achieved 100% of your goal! This is a moment to be truly proud of. Your dedication and discipline have paid off. Whether you use this for its intended purpose or roll it into a bigger goal, you've proven you can achieve anything you set your mind to!",
      suggestions: [
        "Take a victory photo of your achievement",
        "Set an even more ambitious goal",
        "Mentor someone else on saving"
      ],
      resources: [
        "Wealth building: www.iwillteachyoutoberich.com",
        "Investment strategies: www.morningstar.com",
        "Financial planning: www.cfp.net"
      ],
      sentiment: 'celebratory',
      showWarning: false
    }
  },
  
  investment: {
    low: {
      message: "It's good you're thinking about investing! However, you've just started building this savings. Consider reaching your initial goal first - it will give you more options and bargaining power for better investment opportunities.",
      suggestions: [
        "Finish this goal first for a stronger position",
        "Research while you continue saving",
        "Beware of 'urgent' investment opportunities"
      ],
      resources: [
        "Investment scams: www.investor.gov/protect-your-investments",
        "Due diligence: www.sec.gov",
        "Risk assessment: www.finra.org"
      ],
      sentiment: 'cautious',
      showWarning: false
    },
    medium: {
      message: "Diversifying is smart, but timing matters. You're halfway to your goal - is this new opportunity so time-sensitive that it can't wait? Remember, the best investment is often the one you understand completely.",
      suggestions: [
        "Get a second opinion on this opportunity",
        "Compare returns to your current savings rate",
        "Keep at least half as emergency fund"
      ],
      resources: [
        "Investment basics: www.investopedia.com",
        "Risk vs. reward: www.schwab.com",
        "Portfolio theory: www.efficientfrontier.com"
      ],
      sentiment: 'cautious',
      showWarning: false
    },
    high: {
      message: "You're nearly there! Before pivoting to a new investment, consider: you've already got a winning strategy. Is this new opportunity thoroughly vetted? Sometimes the best investment is completing what you started.",
      suggestions: [
        "Finish this goal, then diversify",
        "Ensure the new opportunity is legitimate",
        "Never invest money you can't afford to lose"
      ],
      resources: [
        "Investment research: www.morningstar.com",
        "Warren Buffett's principles: www.berkshirehathaway.com",
        "Risk management: www.investmentnews.com"
      ],
      sentiment: 'cautious',
      showWarning: true
    },
    complete: {
      message: "Great job reaching your goal! Now you have capital to invest wisely. Before jumping into any opportunity, ensure you've done thorough due diligence. Diversification is key, but so is keeping an emergency fund.",
      suggestions: [
        "Keep 3-6 months expenses as emergency fund",
        "Start with low-cost index funds",
        "Avoid putting all eggs in one basket"
      ],
      resources: [
        "Bogleheads guide: www.bogleheads.org",
        "Asset allocation: www.vanguard.com",
        "Tax-efficient investing: www.fidelity.com"
      ],
      sentiment: 'supportive',
      showWarning: false
    }
  },
  
  other: {
    low: {
      message: "Starting to save is challenging, and it's natural to have second thoughts. Whatever your reason, remember that even small amounts of savings provide security and options. What would help you feel better about continuing?",
      suggestions: [
        "Adjust your goal if it feels too ambitious",
        "Take a short break but keep the funds",
        "Find an accountability partner"
      ],
      resources: [
        "Savings motivation: www.thesimpledollar.com",
        "Financial wellness: www.360financialliteracy.org",
        "Community support: www.reddit.com/r/personalfinance"
      ],
      sentiment: 'supportive',
      showWarning: false
    },
    medium: {
      message: "You've made solid progress! Whatever your reason for considering withdrawal, remember that this money represents your hard work and discipline. Is there a way to address your need without undoing all this progress?",
      suggestions: [
        "Consider withdrawing only part of it",
        "Look for alternative solutions",
        "Sleep on it for 24 hours"
      ],
      resources: [
        "Decision making: www.mindtools.com",
        "Financial alternatives: www.nerdwallet.com",
        "Budget help: www.youneedabudget.com"
      ],
      sentiment: 'supportive',
      showWarning: false
    },
    high: {
      message: "You're so close to achieving your goal! Whatever the reason, you've proven you have incredible discipline. Before withdrawing, consider how amazing it will feel to complete this. Can your need wait just a bit longer?",
      suggestions: [
        "You're almost there - consider waiting",
        "Withdraw only the minimum needed",
        "Think about how far you've come"
      ],
      resources: [
        "Goal achievement: www.success.com",
        "Financial planning: www.mint.com",
        "Motivation: www.ted.com/topics/motivation"
      ],
      sentiment: 'supportive',
      showWarning: false
    },
    complete: {
      message: "Congratulations on reaching your goal! You've accomplished something many people struggle with. Whatever you decide to do with these funds, you've proven you can set and achieve financial goals. What's next for you?",
      suggestions: [
        "Consider your next financial goal",
        "Keep some as an emergency fund",
        "Celebrate your achievement responsibly"
      ],
      resources: [
        "Financial success: www.daveramsey.com",
        "Wealth building: www.richdad.com",
        "Next steps: www.kiplinger.com"
      ],
      sentiment: 'celebratory',
      showWarning: false
    }
  }
};

// Success stories for motivation
const successStories = {
  gambling: [
    "Sarah M.: 'I was about to withdraw for lottery tickets. The 24-hour wait made me realize I was chasing losses. One year later, I bought my first car with my savings!'",
    "Mike T.: 'The helpline saved me. Instead of gambling, I started tracking my savings like a game. Way better odds!'",
    "Anna K.: 'Every time I wanted to gamble, I added $5 to savings instead. Now I have $2,000 and zero regrets.'"
  ],
  general: [
    "James L.: 'Almost quit at 50%. So glad I didn't - used my savings for a coding bootcamp that changed my life!'",
    "Rita P.: 'The counseling messages kept me going. Hit my goal and started investing. Never looked back!'",
    "David C.: 'Withdrew once, regretted it immediately. Started over and now I'm debt-free!'"
  ]
};

class WithdrawalGuidance {
  getFallbackResponse(reason: string, progress: number): FallbackResponse {
    const reasonResponses = withdrawalResponses[reason] || withdrawalResponses.other;
    
    if (progress >= 100) {
      return reasonResponses.complete;
    } else if (progress >= 67) {
      return reasonResponses.high;
    } else if (progress >= 34) {
      return reasonResponses.medium;
    } else {
      return reasonResponses.low;
    }
  }

  getSuccessStory(reason: string): string | null {
    if (reason === 'gambling' && successStories.gambling.length > 0) {
      const randomIndex = Math.floor(Math.random() * successStories.gambling.length);
      return successStories.gambling[randomIndex];
    } else if (successStories.general.length > 0) {
      const randomIndex = Math.floor(Math.random() * successStories.general.length);
      return successStories.general[randomIndex];
    }
    return null;
  }

  getMotivationalQuote(): string {
    const quotes = [
      "Every dollar saved is a vote for your future self.",
      "Small progress is still progress.",
      "Your savings are a reflection of your priorities.",
      "Financial freedom starts with a single saved dollar.",
      "Discipline today, freedom tomorrow.",
      "You're not saving money, you're buying options.",
      "The best time to save was yesterday. The second best is today.",
      "Compound interest is the 8th wonder of the world.",
      "A penny saved is more than a penny earned - it's tax free!",
      "Your future self will thank your present self."
    ];
    
    const randomIndex = Math.floor(Math.random() * quotes.length);
    return quotes[randomIndex];
  }

  getAlternativeActions(reason: string): string[] {
    const alternatives: Record<string, string[]> = {
      gambling: [
        "Play a free mobile game for entertainment",
        "Join a fantasy sports league (free version)",
        "Start a savings challenge with friends",
        "Track stocks without investing (paper trading)"
      ],
      emergency: [
        "Sell items you no longer need",
        "Pick up a quick gig (Uber, DoorDash, TaskRabbit)",
        "Ask family for a short-term loan",
        "Check if you have unused gift cards"
      ],
      'changed-mind': [
        "Pause contributions but keep saved amount",
        "Reduce your monthly contribution instead",
        "Change your goal to something more exciting",
        "Find an accountability buddy"
      ],
      investment: [
        "Paper trade first to test the strategy",
        "Start with a smaller test amount",
        "Research for one more week",
        "Get a second opinion from a financial advisor"
      ]
    };
    
    return alternatives[reason] || [
      "Sleep on it for 24 hours",
      "Talk to someone you trust",
      "Review your original motivation",
      "Consider a smaller withdrawal"
    ];
  }
}

export const withdrawalGuidance = new WithdrawalGuidance();