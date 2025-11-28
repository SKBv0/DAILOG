import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { Search, Filter, X, Zap, ArrowRight, Hash, Link, FileText } from 'lucide-react';
import { useFuzzySearch, SearchResult, SearchFilters } from '../utils/fuzzySearch';
import { useWorkerFuzzySearch } from '../hooks/useWorkerFuzzySearch';
import { DialogNode } from '../types/dialog';
import { Connection } from '../types/nodes';
import { usePerformanceTracker } from '../utils/performanceProfiler';
import { isFeatureEnabled } from '../config/features';
import { useDebounce } from '../hooks/useDebounce';
import logger from "../utils/logger";

export interface SmartSearchBarProps {
  nodes: DialogNode[];
  connections: Connection[];
  onNodeSelect?: (nodeId: string) => void;
  onConnectionSelect?: (connection: Connection) => void;
  onClose?: () => void;
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
}

interface SearchState {
  query: string;
  isOpen: boolean;
  selectedIndex: number;
  showFilters: boolean;
  filters: SearchFilters;
  searchMode: 'global' | 'nodes' | 'connections';
}

const SmartSearchBar: React.FC<SmartSearchBarProps> = ({
  nodes,
  connections,
  onNodeSelect,
  onConnectionSelect,
  onClose,
  placeholder = "Search nodes, connections, and content...",
  className = "",
  autoFocus = false,
}) => {
  const [searchState, setSearchState] = useState<SearchState>({
    query: '',
    isOpen: false,
    selectedIndex: 0,
    showFilters: false,
    filters: {},
    searchMode: 'global',
  });

  const [isIndexing, setIsIndexing] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [visibleCount, setVisibleCount] = useState<number>(12);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);
  const filtersRef = useRef<HTMLDivElement>(null);
  const perfTracker = usePerformanceTracker('SmartSearchBar');
  
  const fuzzySearch = useFuzzySearch();
  const workerSearch = useWorkerFuzzySearch();
  const debouncedQuery = useDebounce(searchState.query, 350);
  

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (!searchState.showFilters) return;
      const target = e.target as Node;
      if (
        containerRef.current &&
        !containerRef.current.contains(target) &&
        filtersRef.current &&
        !filtersRef.current.contains(target)
      ) {
        setSearchState((prev) => ({ ...prev, showFilters: false }));
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [searchState.showFilters]);

  const nodesSignature = useMemo(() => {
    return nodes
      .map(n => `${n.id}:${n.type}:${n.data?.text?.length || 0}:${n.data?.metadata?.nodeData?.tags?.length || 0}`)
      .sort()
      .join(",");
  }, [nodes]);

  const connectionsSignature = useMemo(() => {
    return connections
      .map(c => `${c.id || `${c.source}-${c.target}`}:${c.source}:${c.target}`)
      .sort()
      .join(",");
  }, [connections]);

  const indexSignature = useMemo(() => `${nodesSignature}|${connectionsSignature}`, [nodesSignature, connectionsSignature]);

  const indexDataRef = useRef<string>('');
  const lastWorkerInitState = useRef(false);
  
  useEffect(() => {
    if (!isFeatureEnabled("FUZZY_SEARCH")) return;
    
    if (workerSearch.isInitialized && !lastWorkerInitState.current) {
      logger.debug('[SmartSearchBar] Worker just initialized, resetting index');
      indexDataRef.current = '';
      lastWorkerInitState.current = true;
    } else if (!workerSearch.isInitialized) {
      lastWorkerInitState.current = false;
    }
    
    if (indexDataRef.current === indexSignature) return;
    
    const isCurrentlyIndexing = workerSearch.isInitialized 
      ? workerSearch.isIndexing || workerSearch.stats.indexingInProgress
      : (fuzzySearch.getStats?.()?.indexingInProgress ?? false);
    
    if (isCurrentlyIndexing) return;

    let cancelled = false;

    const indexData = async () => {
      setIsIndexing(true);
      perfTracker.startMeasurement("indexing");

      try {
        const cleanNodes = nodes.map(({ data, ...node }) => {
          const { onGenerateDialog, onDataChange, ...cleanData } = data as any;
          return {
            ...node,
            data: cleanData,
          };
        });

        let retries = 0;
        while (!workerSearch.isInitialized && retries < 10) {
          await new Promise(resolve => setTimeout(resolve, 100));
          retries++;
        }

        if (workerSearch.isInitialized) {
          logger.debug('[SmartSearchBar] Using worker-based search indexing', {
            nodesCount: cleanNodes.length,
            connectionsCount: connections.length
          });
          await workerSearch.createGlobalIndex(cleanNodes, connections);
          logger.debug('[SmartSearchBar] Worker indexing completed');
        } else {
          logger.debug('[SmartSearchBar] Using regular search indexing', {
            nodesCount: cleanNodes.length,
            connectionsCount: connections.length
          });
          await fuzzySearch.indexNodes(cleanNodes);
          await fuzzySearch.indexConnections(connections, cleanNodes);
          await fuzzySearch.createGlobalIndex(cleanNodes, connections);
          logger.debug('[SmartSearchBar] Regular indexing completed');
        }
        
        if (!cancelled) {
          indexDataRef.current = indexSignature;
        }
      } catch (error) {
        logger.error('[SmartSearchBar] Indexing error:', error);
      } finally {
        perfTracker.endMeasurement("indexing");
        if (!cancelled) setIsIndexing(false);
      }
    };

    indexData();

    return () => {
      cancelled = true;
    };
  }, [indexSignature, workerSearch.isInitialized]);

  const [searchResults, setSearchResults] = useState<{
    primary: SearchResult[];
    suggestions: SearchResult[];
    contextual: SearchResult[];
  }>({ primary: [], suggestions: [], contextual: [] });
  
  const lastSearchQueryRef = useRef('');
  const lastSearchModeRef = useRef('');
  const lastFiltersRef = useRef('{}');
  
  useEffect(() => {
    if (!debouncedQuery.trim() || !isFeatureEnabled('FUZZY_SEARCH')) {
      setSearchResults({ primary: [], suggestions: [], contextual: [] });
      return;
    }

    if (isIndexing) {
      logger.debug('[SmartSearchBar] Waiting for indexing to complete...');
      return;
    }

    const currentSearchMode = searchState.searchMode;
    const currentFiltersStr = JSON.stringify(searchState.filters);
    
    if (
      lastSearchQueryRef.current === debouncedQuery &&
      lastSearchModeRef.current === currentSearchMode &&
      lastFiltersRef.current === currentFiltersStr
    ) {
      return;
    }
    
    lastSearchQueryRef.current = debouncedQuery;
    lastSearchModeRef.current = currentSearchMode;
    lastFiltersRef.current = currentFiltersStr;

    perfTracker.startMeasurement('search');
    
    const performSearch = async () => {
      try {
        let results;
        
        if (workerSearch.isInitialized) {
          if (workerSearch.stats.indexingInProgress) {
            logger.debug('[SmartSearchBar] Worker still indexing, waiting...');
            return;
          }

          switch (currentSearchMode) {
            case 'nodes':
              const nodeResults = await workerSearch.searchNodes(debouncedQuery, {});
              results = {
                primary: nodeResults,
                suggestions: [],
                contextual: [],
              };
              break;
            case 'connections':
              const connResults = await workerSearch.searchConnections(debouncedQuery);
              results = {
                primary: connResults,
                suggestions: [],
                contextual: [],
              };
              break;
            default:
              results = await workerSearch.smartSearch(debouncedQuery);
              break;
          }
        } else {
          switch (currentSearchMode) {
            case 'nodes':
              results = {
                primary: fuzzySearch.searchNodes(debouncedQuery, {}, searchState.filters),
                suggestions: [],
                contextual: [],
              };
              break;
            case 'connections':
              results = {
                primary: fuzzySearch.searchConnections(debouncedQuery),
                suggestions: [],
                contextual: [],
              };
              break;
            default:
              results = fuzzySearch.smartSearch(debouncedQuery);
              break;
          }
        }
        
        setSearchResults(results);
        perfTracker.endMeasurement('search');
      } catch (error) {
        logger.error('[SmartSearchBar] Search error:', error);
        setSearchResults({ primary: [], suggestions: [], contextual: [] });
        perfTracker.endMeasurement('search');
      }
    };
    
    performSearch();
  }, [debouncedQuery, searchState.searchMode, searchState.filters, isIndexing, workerSearch.isInitialized, workerSearch.stats]);

  const lastSuggestionsQueryRef = useRef('');
  
  useEffect(() => {
    if (debouncedQuery.length >= 2 && isFeatureEnabled('FUZZY_SEARCH')) {
      if (lastSuggestionsQueryRef.current === debouncedQuery) {
        return;
      }
      
      lastSuggestionsQueryRef.current = debouncedQuery;
      
      const getSuggestionsAsync = async () => {
        try {
          let newSuggestions;
          
          if (workerSearch.isInitialized) {
            newSuggestions = await workerSearch.getSuggestions(debouncedQuery, 5);
          } else {
            newSuggestions = fuzzySearch.getSuggestions(debouncedQuery, 5);
          }
          
          setSuggestions(newSuggestions);
        } catch (error) {
          logger.error('[SmartSearchBar] Suggestions error:', error);
          setSuggestions([]);
        }
      };
      
      getSuggestionsAsync();
    } else {
      setSuggestions([]);
      lastSuggestionsQueryRef.current = '';
    }
  }, [debouncedQuery]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent) => {
    const allResults = [
      ...searchResults.primary,
      ...searchResults.suggestions,
      ...searchResults.contextual,
    ];
    
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setSearchState(prev => ({
          ...prev,
          selectedIndex: Math.min(prev.selectedIndex + 1, allResults.length - 1),
        }));
        break;
      
      case 'ArrowUp':
        event.preventDefault();
        setSearchState(prev => ({
          ...prev,
          selectedIndex: Math.max(prev.selectedIndex - 1, 0),
        }));
        break;
      
      case 'Enter':
        event.preventDefault();
        if (allResults[searchState.selectedIndex]) {
          handleResultSelect(allResults[searchState.selectedIndex]);
        }
        break;
      
      case 'Escape':
        event.preventDefault();
        setSearchState(prev => ({ ...prev, query: '', isOpen: false, showFilters: false }));
        if (!searchState.query && onClose) onClose();
        break;
      
      case 'Tab':
        if (suggestions.length > 0) {
          event.preventDefault();
          setSearchState(prev => ({ ...prev, query: suggestions[0] }));
        }
        break;
    }
  }, [searchResults, searchState.selectedIndex, searchState.query, suggestions, onClose]);

  const handleResultSelect = useCallback((result: SearchResult) => {
    const { item } = result;
    
    switch (item.type) {
      case 'node': {
        if (onNodeSelect) {
          onNodeSelect(item.id);
        }
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('node:focus', { 
            detail: { nodeId: item.id } 
          }));
        }, 100);
        break;
      }
      case 'connection': {
        if (!onConnectionSelect) break;
        const ref = item.originalData;
        let selected: Connection | undefined;
        if (typeof ref === 'string') {
          selected = connections.find(c => c.id === ref);
          if (!selected && ref.includes('-')) {
            const [source, target] = ref.split('-');
            selected = connections.find(c => c.source === source && c.target === target);
          }
        }
        if (selected) {
          onConnectionSelect(selected);
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('node:focus', { 
              detail: { nodeId: selected.target } 
            }));
          }, 100);
        }
        break;
      }
      case 'path': {
        if (!onNodeSelect) break;
        const ref = item.originalData;
        if (typeof ref === 'string' && ref) {
          onNodeSelect(ref);
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('node:focus', { 
              detail: { nodeId: ref } 
            }));
          }, 100);
        }
        break;
      }
    }
    
    setSearchState(prev => ({ ...prev, isOpen: false, query: '' }));
    if (onClose) onClose();
  }, [onNodeSelect, onConnectionSelect, onClose, connections]);

  const handleInputChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setSearchState(prev => ({
      ...prev,
      query: value.slice(0, 200),
      isOpen: value.length > 0,
      selectedIndex: 0,
    }));
    setVisibleCount(12);
  }, []);

  const handleInputFocus = useCallback(() => {
    setSearchState(prev => ({ ...prev, isOpen: prev.query.length > 0 }));
  }, []);

  const handleInputBlur = useCallback((event: React.FocusEvent) => {
    if (resultsRef.current?.contains(event.relatedTarget as Node)) {
      return;
    }
    
    setTimeout(() => {
      setSearchState(prev => ({ ...prev, isOpen: false }));
    }, 150);
  }, []);

  const toggleFilters = useCallback(() => {
    setSearchState(prev => ({ ...prev, showFilters: !prev.showFilters }));
  }, []);

  const updateFilter = useCallback((key: keyof SearchFilters, value: any) => {
    setSearchState(prev => ({
      ...prev,
      filters: { ...prev.filters, [key]: value },
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setSearchState(prev => ({ ...prev, filters: {} }));
  }, []);

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'node': return <FileText className="w-4 h-4" />;
      case 'connection': return <Link className="w-4 h-4" />;
      case 'path': return <ArrowRight className="w-4 h-4" />;
      case 'tag': return <Hash className="w-4 h-4" />;
      default: return <Search className="w-4 h-4" />;
    }
  };

  const getResultTypeColor = (type: string) => {
    switch (type) {
      case 'node': return 'text-blue-400';
      case 'connection': return 'text-green-400';
      case 'path': return 'text-purple-400';
      case 'tag': return 'text-yellow-400';
      default: return 'text-gray-400';
    }
  };

  const highlightMatches = useCallback((text: string | any, highlights: string[]) => {
    const textStr = typeof text === 'string' 
      ? text 
      : (typeof text === 'object' && text !== null 
          ? JSON.stringify(text) 
          : String(text || ''));
    
    if (!highlights.length) return <span>{textStr}</span>;
    
    const regex = new RegExp(`(${highlights.map(h => h.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join('|')})`, "gi");
    const parts = textStr.split(regex);
    
    return (
      <span>
        {parts.map((part, index) => {
          const isHighlight = highlights.some(h => 
            part.toLowerCase() === h.toLowerCase()
          );
          return isHighlight ? (
            <mark 
              key={index} 
              className="px-0.5 rounded bg-blue-500/20 text-blue-200 border border-blue-500/30"
            >
              {part}
            </mark>
          ) : (
            <span key={index}>{part}</span>
          );
        })}
      </span>
    );
  }, []);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
    }
  }, [autoFocus]);

  if (!isFeatureEnabled('FUZZY_SEARCH')) {
    return (
      <div className={`relative ${className}`}>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            ref={inputRef}
            type="text"
            value={searchState.query}
            onChange={handleInputChange}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            onKeyDown={handleKeyDown}
            placeholder="Search (Fuzzy search disabled)"
            disabled
            className="w-full pl-10 pr-10 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 disabled:opacity-50"
          />
        </div>
      </div>
    );
  }

  const allResults = useMemo(() => [
    ...searchResults.primary,
    ...searchResults.suggestions,
    ...searchResults.contextual,
  ], [searchResults.primary, searchResults.suggestions, searchResults.contextual]);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
        <input
          ref={inputRef}
          type="text"
          value={searchState.query}
          onChange={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="w-full pl-10 pr-56 md:pr-64 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/20 transition-all"
        />
        
        <div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-2">
          {isIndexing && (
            <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
          )}
          {/* Inline search mode segmented control */}
          <div className="hidden md:flex items-center bg-gray-800/60 rounded-full px-1 py-0.5 mr-1 border border-gray-700 pointer-events-auto z-10" role="tablist" aria-label="Search mode">
            {(['global', 'nodes', 'connections'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setSearchState(prev => ({ ...prev, searchMode: mode }))}
                className={`px-2 py-0.5 text-[11px] rounded-full transition-colors ${
                  searchState.searchMode === mode
                    ? 'bg-blue-500 text-white'
                    : 'text-gray-300 hover:text-white'
                }`}
                aria-pressed={searchState.searchMode === mode}
                title={`Search ${mode}`}
              >
                {mode.charAt(0).toUpperCase() + mode.slice(1)}
              </button>
            ))}
          </div>

          {/* Shortcut hint */}
          <span className="hidden md:inline-flex items-center px-1.5 py-0.5 text-[10px] text-gray-400 bg-gray-800/60 border border-gray-700 rounded">
            {navigator.platform.includes('Mac') ? '⌘K' : 'Ctrl K'}
          </span>

          <button
            onClick={toggleFilters}
            className={`p-1 rounded transition-colors ${
              searchState.showFilters ? 'text-blue-400 bg-blue-400/10' : 'text-gray-400 hover:text-gray-300'
            }`}
            title="Toggle filters"
          >
            <Filter className="w-4 h-4" />
          </button>
          
          {searchState.query && (
            <button
              onClick={() => setSearchState(prev => ({ ...prev, query: '', isOpen: false }))}
              className="p-1 text-gray-400 hover:text-gray-300 transition-colors"
              title="Clear search"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {searchState.showFilters && (
        <div
          ref={filtersRef}
          className="absolute top-full right-0 mt-2 w-[520px] max-w-[90vw] p-3 bg-gray-900/95 border border-gray-700 rounded-lg shadow-xl z-50"
        >
          <div className="flex items-center justify-between mb-2">
            <h4 className="text-sm font-medium text-white">Search Filters</h4>
            <button
              onClick={clearFilters}
              className="text-xs text-gray-400 hover:text-gray-300"
            >
              Clear All
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Node Types</label>
              <select
                multiple
                value={searchState.filters.nodeTypes || []}
                onChange={(e) => updateFilter('nodeTypes', Array.from(e.target.selectedOptions, option => option.value))}
                className="w-full text-xs bg-gray-800 border border-gray-600 rounded px-2 py-1 text-white"
              >
                <option value="npcDialog">NPC Dialog</option>
                <option value="playerResponse">Player Response</option>
                <option value="sceneDescription">Scene Description</option>
                <option value="choice">Choice</option>
                <option value="branching">Branching</option>
              </select>
            </div>
            
            <div>
              <label className="block text-xs text-gray-400 mb-1">Min Importance</label>
              <input
                type="range"
                min="0"
                max="3"
                step="0.5"
                value={searchState.filters.minImportance || 0}
                onChange={(e) => updateFilter('minImportance', parseFloat(e.target.value))}
                className="w-full"
              />
              <div className="text-xs text-gray-500 mt-1">
                {searchState.filters.minImportance || 0}
              </div>
            </div>
          </div>
          
          <div className="flex gap-4 mt-3">
            <label className="flex items-center text-xs text-gray-400">
              <input
                type="checkbox"
                checked={searchState.filters.hasConnections || false}
                onChange={(e) => updateFilter('hasConnections', e.target.checked || undefined)}
                className="mr-2"
              />
              Has Connections
            </label>
            
            <label className="flex items-center text-xs text-gray-400">
              <input
                type="checkbox"
                checked={searchState.filters.hasTags || false}
                onChange={(e) => updateFilter('hasTags', e.target.checked || undefined)}
                className="mr-2"
              />
              Has Tags
            </label>
          </div>
        </div>
      )}

      {searchState.isOpen && (
        <div
          ref={resultsRef}
          className="absolute top-full left-0 right-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl max-h-96 overflow-y-auto z-50"
        >
          {suggestions.length > 0 && (
            <div className="p-2 border-b border-gray-700">
              <div className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                <Zap className="w-3 h-3" />
                Suggestions
              </div>
              <div className="flex flex-wrap gap-1">
                {suggestions.map((suggestion, index) => {
                  const suggestionStr = typeof suggestion === 'string' 
                    ? suggestion 
                    : (typeof suggestion === 'object' && suggestion !== null 
                        ? JSON.stringify(suggestion) 
                        : String(suggestion || ''));
                  return (
                    <button
                      key={index}
                      onClick={() => setSearchState(prev => ({ ...prev, query: suggestionStr }))}
                      className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-300 rounded transition-colors"
                    >
                      {suggestionStr}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {allResults.length > 0 ? (
            <div className="max-h-80 overflow-y-auto">
              {searchResults.primary.length > 0 && (
                <div className="p-2">
                  <div className="text-xs text-gray-400 mb-2">Results ({searchResults.primary.length})</div>
                  <div className="max-h-96 overflow-y-auto">
                    {searchResults.primary.slice(0, Math.min(visibleCount, searchResults.primary.length)).map((result, index) => (
                    <button
                      key={result.item.id}
                      onClick={() => handleResultSelect(result)}
                      className={`w-full p-3 text-left hover:bg-gray-800 transition-colors rounded ${
                        index === searchState.selectedIndex ? 'bg-gray-800' : ''
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className={`mt-0.5 ${getResultTypeColor(result.item.type)}`}>
                          {getResultIcon(result.item.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-medium text-white truncate">
                              {highlightMatches(result.item.title, result.highlights)}
                            </span>
                            <span className={`text-xs px-1.5 py-0.5 rounded-full ${getResultTypeColor(result.item.type)} bg-opacity-20`}>
                              {typeof result.item.type === 'string' 
                                ? result.item.type 
                                : (typeof result.item.type === 'object' && result.item.type !== null 
                                    ? JSON.stringify(result.item.type) 
                                    : String(result.item.type || 'unknown'))}
                            </span>
                            <span className="text-xs text-gray-500">
                              {(result.score * 100).toFixed(0)}% match
                            </span>
                          </div>
                          <p className="text-sm text-gray-400 line-clamp-2">
                            {highlightMatches(
                              (() => {
                                const contentStr = typeof result.item.content === 'string' 
                                  ? result.item.content 
                                  : (typeof result.item.content === 'object' && result.item.content !== null 
                                      ? JSON.stringify(result.item.content) 
                                      : String(result.item.content || ''));
                                return contentStr.length > 100 
                                  ? contentStr.substring(0, 97) + '...'
                                  : contentStr;
                              })(),
                              result.highlights
                            )}
                          </p>
                          {result.item.metadata?.tags && result.item.metadata.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {result.item.metadata.tags.slice(0, 3).map((tag, tagIndex) => {
                                const tagStr = typeof tag === 'string' 
                                  ? tag 
                                  : (typeof tag === 'object' && tag !== null 
                                      ? JSON.stringify(tag) 
                                      : String(tag || ''));
                                return (
                                  <span
                                    key={tagIndex}
                                    className="text-xs px-1.5 py-0.5 bg-gray-800 text-gray-300 rounded"
                                  >
                                    {tagStr}
                                  </span>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </button>
                    ))}
                    {searchResults.primary.length > visibleCount && (
                      <div className="flex justify-center mt-2">
                        <button
                          onClick={() => setVisibleCount((c) => c + 12)}
                          className="px-3 py-1 text-xs bg-gray-800 hover:bg-gray-700 text-gray-200 rounded border border-gray-700"
                        >
                          Show more
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {searchResults.suggestions.length > 0 && (
                <div className="p-2 border-t border-gray-700">
                  <div className="text-xs text-gray-400 mb-2">Suggestions</div>
                  {searchResults.suggestions.slice(0, 3).map((result) => (
                    <button
                      key={result.item.id}
                      onClick={() => handleResultSelect(result)}
                      className="w-full p-2 text-left hover:bg-gray-800 transition-colors rounded text-sm"
                    >
                      <div className="flex items-center gap-2">
                        <div className={`${getResultTypeColor(result.item.type)}`}>
                          {getResultIcon(result.item.type)}
                        </div>
                        <span className="text-gray-300 truncate">
                          {typeof result.item.title === 'string' 
                            ? result.item.title 
                            : (typeof result.item.title === 'object' && result.item.title !== null 
                                ? JSON.stringify(result.item.title) 
                                : String(result.item.title || ''))}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : searchState.query.trim() ? (
            <div className="p-4 text-center">
              <p className="text-gray-400 text-sm">No results found</p>
              <p className="text-gray-500 text-xs mt-1">
                Try adjusting your search terms or filters
              </p>
            </div>
          ) : null}

          {import.meta.env.DEV && allResults.length > 0 && (
            <div className="p-2 border-t border-gray-700 text-xs text-gray-500">
              Found {allResults.length} results in {searchResults.primary.length > 0 ? 'search' : 'cache'}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SmartSearchBar;