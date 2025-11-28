import { Tag } from "../types/dialog";

export interface ValidationResult {
  valid: boolean;
  score: number;
  issues: ValidationIssue[];
  suggestions?: string[];
}

export interface ValidationIssue {
  type: 'speech_pattern' | 'vocabulary_level' | 'emotional_range' | 'topic_relevance' | 'character_motivation';
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestion: string;
}

export interface TopicContext {
  questTags: Tag[];
  locationTags: Tag[];
  importantContext: string[];
  currentObjective?: string;
}

export class CharacterVoiceValidator {
  private readonly MINIMUM_COHERENCE_THRESHOLD = 0.4;
  private readonly TOPIC_RELEVANCE_THRESHOLD = 0.3;

  validateResponse(
    character: Tag | undefined,
    topicContext: TopicContext,
    response: string,
    _conversationHistory?: string[]
  ): ValidationResult {
    const issues: ValidationIssue[] = [];
    let totalScore = 1.0;

    const topicScore = this.validateTopicRelevance(topicContext, response);
    if (topicScore < this.TOPIC_RELEVANCE_THRESHOLD) {
      issues.push({
        type: 'topic_relevance',
        severity: 'high',
        description: 'Response does not address the current topic or quest context',
        suggestion: 'Focus the response on the current quest, location, or conversation topic'
      });
      totalScore *= 0.3;
    } else {
      totalScore *= topicScore;
    }

    if (character?.metadata?.characterVoice) {
      const voiceResult = this.validateCharacterVoice(character, response);
      issues.push(...voiceResult.issues);
      totalScore *= voiceResult.score;
    }

    if (character) {
      const motivationScore = this.validateCharacterMotivation(character, topicContext, response);
      if (motivationScore < 0.5) {
        issues.push({
          type: 'character_motivation',
          severity: 'medium',
          description: 'Response conflicts with character motivations or personality',
          suggestion: 'Align response with character goals and personality traits'
        });
        totalScore *= motivationScore;
      }
    }

    return {
      valid: totalScore >= this.MINIMUM_COHERENCE_THRESHOLD,
      score: Math.max(0, Math.min(1, totalScore)),
      issues: issues.filter(issue => issue.severity !== 'low'),
      suggestions: issues.length > 0 ? this.generateImprovementSuggestions(issues, character, topicContext) : undefined
    };
  }

  private validateTopicRelevance(topicContext: TopicContext, response: string): number {
    let relevanceScore = 0.5;
    const responseLower = response.toLowerCase();

    const questTerms = this.extractKeyTerms(topicContext.questTags);
    const locationTerms = this.extractKeyTerms(topicContext.locationTags);
    const contextTerms = topicContext.importantContext?.flatMap(ctx => 
      this.extractKeyTermsFromText(ctx)
    ) || [];

    const allRelevantTerms = [...questTerms, ...locationTerms, ...contextTerms];

    let termMatches = 0;
    for (const term of allRelevantTerms) {
      if (responseLower.includes(term.toLowerCase())) {
        termMatches++;
      }
    }

    if (allRelevantTerms.length > 0) {
      relevanceScore = 0.3 + (termMatches / allRelevantTerms.length) * 0.7;
    }

    if (topicContext.currentObjective && 
        responseLower.includes(topicContext.currentObjective.toLowerCase())) {
      relevanceScore = Math.min(1.0, relevanceScore + 0.2);
    }

    const unrelatedTopics = [
      'glass orb', 'crystal ball', 'magic mirror', 'ancient artifact'
    ];
    
    for (const unrelatedTopic of unrelatedTopics) {
      if (responseLower.includes(unrelatedTopic) && 
          !allRelevantTerms.some(term => term.toLowerCase().includes(unrelatedTopic.split(' ')[0]))) {
        relevanceScore *= 0.2;
        break;
      }
    }

    return Math.max(0, Math.min(1, relevanceScore));
  }

  private validateCharacterVoice(character: Tag, response: string): ValidationResult {
    const voice = character.metadata?.characterVoice;
    if (!voice) return { valid: true, score: 1, issues: [] };

    const issues: ValidationIssue[] = [];
    let voiceScore = 1.0;

    if (voice.speechPatterns && voice.speechPatterns.length > 0) {
      const patternScore = this.checkSpeechPatterns(voice.speechPatterns, response);
      if (patternScore < 0.3) {
        issues.push({
          type: 'speech_pattern',
          severity: 'medium',
          description: `Response doesn't match ${character.label}'s typical speech patterns`,
          suggestion: `Use patterns like: ${voice.speechPatterns.slice(0, 2).join(', ')}`
        });
        voiceScore *= 0.7;
      }
    }

    if (voice.vocabularyLevel) {
      const vocabScore = this.checkVocabularyLevel(voice.vocabularyLevel, response);
      if (vocabScore < 0.5) {
        issues.push({
          type: 'vocabulary_level',
          severity: 'low',
          description: `Vocabulary level doesn't match character (expected: ${voice.vocabularyLevel})`,
          suggestion: `Adjust language complexity to match ${voice.vocabularyLevel} level`
        });
        voiceScore *= 0.9;
      }
    }

    if (voice.conversationStyle) {
      const styleScore = this.checkConversationStyle(voice.conversationStyle, response);
      if (styleScore < 0.5) {
        issues.push({
          type: 'speech_pattern',
          severity: 'medium',
          description: `Response doesn't match ${voice.conversationStyle} conversation style`,
          suggestion: `Adopt a more ${voice.conversationStyle} tone and approach`
        });
        voiceScore *= 0.8;
      }
    }

    return {
      valid: voiceScore >= 0.4,
      score: voiceScore,
      issues: issues.filter(issue => issue.severity !== 'low')
    };
  }

  private validateCharacterMotivation(
    character: Tag,
    _topicContext: TopicContext,
    response: string
  ): number {
    const voice = character.metadata?.characterVoice;
    if (!voice?.personalMotivations) return 0.8;

    let motivationScore = 0.7;
    const responseLower = response.toLowerCase();

    for (const motivation of voice.personalMotivations) {
      const motivationTerms = this.extractKeyTermsFromText(motivation);
      const hasAlignment = motivationTerms.some(term => 
        responseLower.includes(term.toLowerCase())
      );
      
      if (hasAlignment) {
        motivationScore += 0.1;
      }
    }

    if (typeof voice.trustLevel === 'number') {
      if (voice.trustLevel <= 3 && this.indicatesTrustOrOpenness(response)) {
        motivationScore *= 0.7;
      } else if (voice.trustLevel >= 7 && this.indicatesDistrust(response)) {
        motivationScore *= 0.8;
      }
    }

    return Math.max(0, Math.min(1, motivationScore));
  }

  private extractKeyTerms(tags: Tag[]): string[] {
    return tags.flatMap(tag => [
      tag.label,
      ...this.extractKeyTermsFromText(tag.content || '')
    ]);
  }

  private extractKeyTermsFromText(text: string): string[] {
    const words = text.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
    const stopWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her', 'was', 'one', 'our', 'had', 'but', 'word', 'use', 'your', 'way', 'about', 'many', 'then', 'them', 'these', 'this', 'that', 'have', 'from', 'they', 'know', 'want', 'been', 'good', 'much', 'some', 'time', 'very', 'when', 'come', 'here', 'just', 'like', 'long', 'make', 'over', 'such', 'take', 'than', 'only', 'well', 'year']);
    
    return words.filter(word => !stopWords.has(word) && word.length > 3).slice(0, 10);
  }

  private checkSpeechPatterns(patterns: string[], response: string): number {
    if (patterns.length === 0) return 1;
    
    let matchScore = 0;
    const responseLower = response.toLowerCase();
    
    for (const pattern of patterns) {
      const patternLower = pattern.toLowerCase();
      if (responseLower.includes(patternLower)) {
        matchScore += 1;
      } else if (this.hasSimilarPattern(patternLower, responseLower)) {
        matchScore += 0.5;
      }
    }
    
    return Math.min(1, matchScore / patterns.length * 2);
  }

  private checkVocabularyLevel(expectedLevel: string, response: string): number {
    const words = response.split(/\s+/);
    const avgWordLength = words.reduce((sum, word) => sum + word.length, 0) / words.length;
    const complexWords = words.filter(word => word.length > 6).length / words.length;
    
    switch (expectedLevel) {
      case 'simple':
        return avgWordLength <= 5 ? 1 : 0.6;
      case 'moderate':
        return avgWordLength >= 4 && avgWordLength <= 6 ? 1 : 0.7;
      case 'complex':
        return complexWords > 0.2 ? 1 : 0.6;
      case 'archaic':
        return this.hasArchaicLanguage(response) ? 1 : 0.5;
      default:
        return 0.8;
    }
  }

  private checkConversationStyle(expectedStyle: string, response: string): number {
    switch (expectedStyle) {
      case 'formal':
        return this.isFormalLanguage(response) ? 1 : 0.4;
      case 'casual':
        return this.hasCasualLanguage(response) ? 1 : 0.6;
      case 'aggressive':
        return this.hasAggressiveLanguage(response) ? 1 : 0.5;
      case 'evasive':
        return this.hasEvasiveLanguage(response) ? 1 : 0.6;
      case 'supportive':
        return this.hasSupportiveLanguage(response) ? 1 : 0.7;
      default:
        return 0.8;
    }
  }

  private hasSimilarPattern(pattern: string, response: string): boolean {
    const patternPunctuation = pattern.match(/[.!?]/g)?.length || 0;
    const responsePunctuation = response.match(/[.!?]/g)?.length || 0;
    
    return Math.abs(patternPunctuation - responsePunctuation) <= 1;
  }

  private hasArchaicLanguage(text: string): boolean {
    const archaicWords = ['thee', 'thou', 'hath', 'doth', 'whilst', 'verily', 'forsooth'];
    return archaicWords.some(word => text.toLowerCase().includes(word));
  }

  private isFormalLanguage(text: string): boolean {
    const formalIndicators = ['furthermore', 'moreover', 'consequently', 'therefore'];
    return formalIndicators.some(indicator => text.toLowerCase().includes(indicator)) ||
           !text.includes("'");
  }

  private hasCasualLanguage(text: string): boolean {
    return text.includes("'") ||
           /\b(yeah|okay|sure|nah|gonna|wanna)\b/i.test(text);
  }

  private hasAggressiveLanguage(text: string): boolean {
    return /\b(damn|hell|angry|furious|rage)\b/i.test(text) ||
           text.includes('!') && text.split('!').length > 2;
  }

  private hasEvasiveLanguage(text: string): boolean {
    // CRITICAL FIX: Removed 'hmm' check to prevent validation loop
    // "Hmm" is a natural speech pattern, not necessarily evasive
    // Context matters more than individual words
    return /\b(maybe|perhaps|could be|not sure|difficult to say)\b/i.test(text) ||
           text.includes('...');
  }

  private hasSupportiveLanguage(text: string): boolean {
    return /\b(help|support|together|understand|care|worry)\b/i.test(text);
  }

  private indicatesTrustOrOpenness(text: string): boolean {
    return /\b(trust|believe|friend|ally|help|share|tell)\b/i.test(text);
  }

  private indicatesDistrust(text: string): boolean {
    return /\b(doubt|suspicious|careful|wary|distrust|lie|deceive)\b/i.test(text);
  }

  private generateImprovementSuggestions(
    issues: ValidationIssue[],
    character: Tag | undefined,
    topicContext: TopicContext
  ): string[] {
    const suggestions: string[] = [];

    if (issues.some(i => i.type === 'topic_relevance')) {
      if (topicContext.questTags.length > 0) {
        suggestions.push(`Focus on the current quest: ${topicContext.questTags[0].label}`);
      }
      if (topicContext.currentObjective) {
        suggestions.push(`Address the current objective: ${topicContext.currentObjective}`);
      }
    }

    if (character && issues.some(i => i.type === 'speech_pattern')) {
      const voice = character.metadata?.characterVoice;
      if (voice?.speechPatterns && voice.speechPatterns.length > 0) {
        suggestions.push(`Use ${character.label}'s typical phrases: ${voice.speechPatterns[0]}`);
      }
    }

    if (issues.some(i => i.type === 'character_motivation')) {
      suggestions.push(`Remember this character's goals and personality when responding`);
    }

    return suggestions;
  }

  quickValidate(character: Tag | undefined, response: string): {
    isValid: boolean;
    mainIssue?: string;
    quickSuggestion?: string;
  } {
    if (!response || response.trim().length < 3) {
      return {
        isValid: false,
        mainIssue: 'Response too short',
        quickSuggestion: 'Add more content to the response'
      };
    }

    if (character?.metadata?.characterVoice) {
      const voice = character.metadata.characterVoice;
      
      if (voice.speechPatterns && voice.speechPatterns.length > 0) {
        const hasPattern = voice.speechPatterns.some(pattern =>
          response.toLowerCase().includes(pattern.toLowerCase())
        );
        
        if (!hasPattern && response.length > 50) {
          return {
            isValid: false,
            mainIssue: 'Doesn\'t match character speech patterns',
            quickSuggestion: `Try using: ${voice.speechPatterns[0]}`
          };
        }
      }
    }

    return { isValid: true };
  }
}

export const characterVoiceValidator = new CharacterVoiceValidator();