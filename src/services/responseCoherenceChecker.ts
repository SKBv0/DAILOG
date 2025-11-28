import { Tag } from "../types/dialog";

export interface CoherenceResult {
  score: number; // 0-1 scale
  isCoherent: boolean;
  issues: CoherenceIssue[];
  strengths: string[];
}

export interface CoherenceIssue {
  type: 'context_disconnect' | 'character_inconsistency' | 'flow_disruption' | 'semantic_mismatch';
  severity: 'low' | 'medium' | 'high';
  description: string;
  suggestion: string;
  confidence: number;
}

export interface ContextAlignment {
  previousContext: string[];
  questContext: string[];
  characterContext: string[];
  locationContext: string[];
}

export class ResponseCoherenceChecker {
  private readonly COHERENCE_THRESHOLD = 0.4;

  checkContextAlignment(
    context: ContextAlignment,
    response: string,
    characterTag?: Tag
  ): CoherenceResult {
    const issues: CoherenceIssue[] = [];
    const strengths: string[] = [];
    let totalScore = 1.0;

    const contextScore = this.validateContextAlignment(context.previousContext, response);
    if (contextScore.score < 0.3) {
      issues.push({
        type: 'context_disconnect',
        severity: 'high',
        description: 'Response does not align with previous conversation context',
        suggestion: 'Reference or build upon previous statements in the conversation',
        confidence: contextScore.confidence
      });
      totalScore *= 0.7;
    } else if (contextScore.score > 0.7) {
      strengths.push('Good contextual continuity');
    }

    if (context.questContext.length > 0) {
      const questScore = this.validateQuestAlignment(context.questContext, response);
      if (questScore < 0.2) {
        issues.push({
          type: 'context_disconnect',
          severity: 'medium', // Reduced severity
          description: 'Response ignores current quest or objective context',
          suggestion: 'Address the current quest, mission, or objective directly',
          confidence: 0.9
        });
        totalScore *= 0.6;
      } else if (questScore > 0.6) {
        strengths.push('Addresses quest objectives appropriately');
      }
    }

    if (characterTag?.metadata?.characterVoice) {
      const motivationScore = this.validateCharacterMotivation(
        characterTag.metadata.characterVoice,
        response,
        context
      );
      if (motivationScore.score < 0.5) {
        issues.push({
          type: 'character_inconsistency',
          severity: 'medium',
          description: motivationScore.reason,
          suggestion: 'Align response with character motivations and personality',
          confidence: motivationScore.confidence
        });
        totalScore *= 0.8;
      } else if (motivationScore.score > 0.7) {
        strengths.push('Maintains character motivation consistency');
      }
    }

    const flowScore = this.validateDialogFlow(context.previousContext, response);
    if (flowScore < 0.4) {
      issues.push({
        type: 'flow_disruption',
        severity: 'medium',
        description: 'Response disrupts natural dialog flow',
        suggestion: 'Ensure response naturally follows from previous statements',
        confidence: 0.7
      });
      totalScore *= 0.8;
    } else if (flowScore > 0.6) {
      strengths.push('Natural dialog flow progression');
    }

    const semanticScore = this.validateSemanticCoherence(response);
    if (semanticScore < 0.5) {
      issues.push({
        type: 'semantic_mismatch',
        severity: 'low',
        description: 'Response has internal semantic inconsistencies',
        suggestion: 'Ensure all parts of the response relate to each other logically',
        confidence: 0.6
      });
      totalScore *= 0.9;
    }

    const finalScore = Math.max(0, Math.min(1, totalScore));
    
    return {
      score: finalScore,
      isCoherent: finalScore >= this.COHERENCE_THRESHOLD,
      issues: issues.filter(issue => issue.severity !== 'low'), // Reduce verbosity
      strengths: finalScore > 0.6 ? strengths : [] // Only show strengths for good scores
    };
  }

  /**
   * Validates response alignment with previous conversation context
   */
  private validateContextAlignment(previousContext: string[], response: string): {
    score: number;
    confidence: number;
  } {
    if (previousContext.length === 0) {
      return { score: 0.8, confidence: 0.3 }; // Neutral for no context
    }

    const responseWords = this.extractKeywords(response);
    const contextWords = previousContext.flatMap(ctx => this.extractKeywords(ctx));
    
    const overlap = responseWords.filter(word => contextWords.includes(word));
    const overlapRatio = overlap.length / Math.max(responseWords.length, 1);
    
    let referenceScore = 0;
    const recentContext = previousContext.slice(-2); // Last 2 messages
    
    for (const contextMsg of recentContext) {
      if (this.hasDirectReference(response, contextMsg)) {
        referenceScore += 0.3;
      }
    }

    const topicConsistency = this.calculateTopicConsistency(previousContext, response);
    
    const combinedScore = (overlapRatio * 0.4) + (referenceScore * 0.4) + (topicConsistency * 0.2);
    
    return {
      score: Math.min(1, combinedScore),
      confidence: previousContext.length >= 2 ? 0.8 : 0.5
    };
  }

  /**
   * Validates response alignment with quest/objective context
   */
  private validateQuestAlignment(questContext: string[], response: string): number {
    if (questContext.length === 0) return 0.8;

    const questKeywords = questContext.flatMap(quest => this.extractQuestKeywords(quest));
    const responseKeywords = this.extractKeywords(response);
    
    const questRelevance = questKeywords.filter(keyword => 
      responseKeywords.some(respWord => 
        respWord.includes(keyword.toLowerCase()) || keyword.toLowerCase().includes(respWord)
      )
    ).length;

    const directAddressing = questContext.some(quest =>
      this.hasDirectReference(response, quest)
    );

    const baseScore = questRelevance / Math.max(questKeywords.length, 1);
    return Math.min(1, baseScore + (directAddressing ? 0.3 : 0));
  }

  /**
   * Validates character motivation consistency
   */
  private validateCharacterMotivation(
    characterVoice: any,
    response: string,
    context: ContextAlignment
  ): { score: number; reason: string; confidence: number } {
    let score = 0.8; // Default neutral
    let reason = "";
    let confidence = 0.6;

    if (characterVoice.personalMotivations && characterVoice.personalMotivations.length > 0) {
      const motivationAlignment = this.checkMotivationAlignment(
        characterVoice.personalMotivations,
        response
      );
      
      if (motivationAlignment < 0.3) {
        score = 0.4;
        reason = "Response conflicts with character's core motivations";
        confidence = 0.8;
      } else if (motivationAlignment > 0.6) {
        score = 0.9;
      }
    }

    if (typeof characterVoice.trustLevel === 'number') {
      const trustConsistency = this.checkTrustConsistency(
        characterVoice.trustLevel,
        response,
        context
      );
      
      if (!trustConsistency.consistent) {
        score = Math.min(score, 0.5);
        reason = trustConsistency.reason;
        confidence = 0.7;
      }
    }

    if (characterVoice.emotionalRange) {
      const emotionalConsistency = this.checkEmotionalConsistency(
        characterVoice.emotionalRange,
        response
      );
      
      if (!emotionalConsistency) {
        score = Math.min(score, 0.6);
        reason = reason || "Response emotion doesn't match character's emotional range";
        confidence = 0.6;
      }
    }

    return { score, reason, confidence };
  }

  /**
   * Validates natural dialog flow progression
   */
  private validateDialogFlow(previousContext: string[], response: string): number {
    if (previousContext.length === 0) return 0.8;

    const lastMessage = previousContext[previousContext.length - 1];
    
    const isAppropriateResponse = this.isAppropriateResponse(lastMessage, response);
    let flowScore = isAppropriateResponse ? 0.7 : 0.3;
    
    if (this.hasAbruptTopicChange(lastMessage, response)) {
      flowScore *= 0.6;
    }
    
    const responseTypeScore = this.checkResponseType(lastMessage, response);
    flowScore = (flowScore + responseTypeScore) / 2;
    
    return Math.min(1, flowScore);
  }

  /**
   * Validates internal semantic coherence of the response
   */
  private validateSemanticCoherence(response: string): number {
    const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    if (sentences.length <= 1) return 0.8;
    
    let coherenceScore = 0.8;
    
    for (let i = 0; i < sentences.length - 1; i++) {
      for (let j = i + 1; j < sentences.length; j++) {
        if (this.areContradictory(sentences[i], sentences[j])) {
          coherenceScore -= 0.2;
        }
      }
    }
    
    const topicConsistency = this.calculateInternalTopicConsistency(sentences);
    coherenceScore = (coherenceScore + topicConsistency) / 2;
    
    return Math.max(0, coherenceScore);
  }

  /**
   * Helper methods
   */
  private extractKeywords(text: string): string[] {
    return text.toLowerCase()
      .match(/\b[a-z]{3,}\b/g)
      ?.filter(word => !this.isStopWord(word)) || [];
  }

  private extractQuestKeywords(questText: string): string[] {
    const questSpecificWords = questText.toLowerCase()
      .match(/\b[a-z]{3,}\b/g)
      ?.filter(word => !this.isStopWord(word) && this.isQuestRelevant(word)) || [];
    
    return questSpecificWords;
  }

  private isStopWord(word: string): boolean {
    const stopWords = new Set([
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'her',
      'was', 'one', 'our', 'had', 'but', 'words', 'use', 'your', 'way', 'about',
      'many', 'then', 'them', 'these', 'this', 'that', 'have', 'from', 'they',
      'know', 'want', 'been', 'good', 'much', 'some', 'time', 'very', 'when',
      'come', 'here', 'just', 'like', 'long', 'make', 'over', 'such', 'take',
      'than', 'only', 'well', 'year', 'would', 'could', 'should', 'will'
    ]);
    return stopWords.has(word);
  }

  private isQuestRelevant(word: string): boolean {
    const questWords = new Set([
      'find', 'search', 'seek', 'locate', 'discover', 'retrieve', 'collect',
      'defeat', 'kill', 'destroy', 'eliminate', 'stop', 'prevent',
      'deliver', 'bring', 'take', 'carry', 'transport', 'escort',
      'talk', 'speak', 'ask', 'tell', 'inform', 'report',
      'protect', 'defend', 'guard', 'save', 'rescue',
      'investigate', 'explore', 'examine', 'inspect'
    ]);
    return questWords.has(word);
  }

  private hasDirectReference(response: string, contextText: string): boolean {
    const contextWords = this.extractKeywords(contextText);
    const responseWords = this.extractKeywords(response);
    
    const significantOverlap = contextWords.filter(word => 
      word.length >= 4 && responseWords.includes(word)
    ).length;
    
    return significantOverlap >= 2;
  }

  private calculateTopicConsistency(previousContext: string[], response: string): number {
    if (previousContext.length === 0) return 0.8;
    
    const contextTopics = previousContext.flatMap(ctx => this.extractKeywords(ctx));
    const responseTopics = this.extractKeywords(response);
    
    const topicOverlap = contextTopics.filter(topic => responseTopics.includes(topic));
    return topicOverlap.length / Math.max(responseTopics.length, 1);
  }

  private checkMotivationAlignment(motivations: string[], response: string): number {
    const responseWords = this.extractKeywords(response);
    let alignmentScore = 0;
    
    for (const motivation of motivations) {
      const motivationWords = this.extractKeywords(motivation);
      const overlap = motivationWords.filter(word => responseWords.includes(word));
      alignmentScore += overlap.length / Math.max(motivationWords.length, 1);
    }
    
    return alignmentScore / motivations.length;
  }

  private checkTrustConsistency(
    trustLevel: number,
    response: string,
    _context: ContextAlignment
  ): { consistent: boolean; reason: string } {
    const responseWords = response.toLowerCase();
    
    if (trustLevel >= 7) {
      if (responseWords.includes('suspicious') || responseWords.includes('distrust') || 
          responseWords.includes('careful') || responseWords.includes('wary')) {
        return { 
          consistent: false, 
          reason: "High-trust character displaying excessive suspicion" 
        };
      }
    }
    
    if (trustLevel <= 3) {
      if (responseWords.includes('trust') || responseWords.includes('believe') || 
          responseWords.includes('friend') || responseWords.includes('help')) {
        return { 
          consistent: false, 
          reason: "Low-trust character being overly trusting or helpful" 
        };
      }
    }
    
    return { consistent: true, reason: "" };
  }

  private checkEmotionalConsistency(emotionalRange: Record<string, number>, response: string): boolean {
    const responseText = response.toLowerCase();
    
    for (const [emotion, intensity] of Object.entries(emotionalRange)) {
      if (intensity < 3) {
        const emotionWords = this.getEmotionWords(emotion);
        if (emotionWords.some(word => responseText.includes(word))) {
          return false;
        }
      }
    }
    
    return true;
  }

  private getEmotionWords(emotion: string): string[] {
    const emotionMap: Record<string, string[]> = {
      'angry': ['furious', 'rage', 'mad', 'angry', 'irritated'],
      'happy': ['joyful', 'excited', 'pleased', 'delighted', 'cheerful'],
      'sad': ['sorrow', 'grief', 'melancholy', 'dejected', 'downhearted'],
      'fear': ['terrified', 'frightened', 'scared', 'anxious', 'worried'],
      'suspicious': ['doubt', 'distrust', 'wary', 'skeptical', 'cautious']
    };
    
    return emotionMap[emotion] || [];
  }

  private isAppropriateResponse(lastMessage: string, response: string): boolean {
    if (lastMessage.includes('?')) {
      return !response.toLowerCase().startsWith('what') && 
             !response.toLowerCase().startsWith('who') &&
             !response.toLowerCase().startsWith('when');
    }
    
    return true;
  }

  private hasAbruptTopicChange(lastMessage: string, response: string): boolean {
    const lastTopics = this.extractKeywords(lastMessage);
    const responseTopics = this.extractKeywords(response);
    
    const sharedTopics = lastTopics.filter(topic => responseTopics.includes(topic));
    
    return sharedTopics.length === 0 && lastTopics.length > 2 && responseTopics.length > 2;
  }

  private checkResponseType(lastMessage: string, response: string): number {
    if (lastMessage.includes('?')) {
      if (response.includes('?') && !response.includes('.') && !response.includes('!')) {
        return 0.4;
      }
      return 0.8;
    }
    
    return 0.7;
  }

  private areContradictory(sentence1: string, sentence2: string): boolean {
    const negations = ['not', 'never', 'no', "don't", "won't", "can't", "isn't", "aren't"];
    const s1Lower = sentence1.toLowerCase();
    const s2Lower = sentence2.toLowerCase();
    
    const s1HasNegation = negations.some(neg => s1Lower.includes(neg));
    const s2HasNegation = negations.some(neg => s2Lower.includes(neg));
    
    if (s1HasNegation !== s2HasNegation) {
      const s1Keywords = this.extractKeywords(sentence1);
      const s2Keywords = this.extractKeywords(sentence2);
      const sharedKeywords = s1Keywords.filter(kw => s2Keywords.includes(kw));
      
      return sharedKeywords.length > 0;
    }
    
    return false;
  }

  private calculateInternalTopicConsistency(sentences: string[]): number {
    if (sentences.length <= 1) return 1.0;
    
    const allTopics = sentences.map(s => this.extractKeywords(s));
    let consistencyScore = 0;
    
    for (let i = 0; i < allTopics.length - 1; i++) {
      const overlap = allTopics[i].filter(topic => 
        allTopics.slice(i + 1).some(topicSet => topicSet.includes(topic))
      );
      consistencyScore += overlap.length / Math.max(allTopics[i].length, 1);
    }
    
    return consistencyScore / Math.max(sentences.length - 1, 1);
  }

  /**
   * Quick coherence check for real-time validation
   */
  quickCoherenceCheck(
    previousMessage: string | undefined,
    response: string
  ): { isCoherent: boolean; mainIssue?: string } {
    if (!previousMessage) {
      return { isCoherent: true };
    }

    if (this.hasAbruptTopicChange(previousMessage, response)) {
      return {
        isCoherent: false,
        mainIssue: 'Response changes topic abruptly'
      };
    }

    if (previousMessage.includes('?') && 
        response.toLowerCase().startsWith('what') &&
        !response.includes('.') && !response.includes('!')) {
      return {
        isCoherent: false,
        mainIssue: 'Question answered with another question'
      };
    }

    return { isCoherent: true };
  }
}

export const responseCoherenceChecker = new ResponseCoherenceChecker();