"""
Dimensional Coverage Analysis for E1a Emergent Extraction

This script helps researchers code emergent themes to strategic dimensions
for retrospective analysis of whether emergent extraction captures critical
strategic dimensions.
"""

import json
from typing import List, Dict, Any
from sqlalchemy import create_engine, text
import os
from dotenv import load_dotenv

load_dotenv('.env.local')

# Strategic dimensions to code for
DIMENSIONS = [
    'customer_market_understanding',
    'value_proposition_differentiation',
    'capabilities_advantages',
    'competitive_context',
    'growth_model',
    'operational_execution',
    'technical_innovation',
]

class DimensionalCoverageAnalyzer:
    def __init__(self):
        database_url = os.getenv('DATABASE_URL')
        if not database_url:
            raise ValueError("DATABASE_URL not found in environment")

        self.engine = create_engine(database_url)

    def get_emergent_traces(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Get traces from emergent-extraction-e1a variant"""
        query = text("""
            SELECT
                t.id,
                t."conversationId",
                t."extractedContext",
                t.output,
                t."qualityRating",
                c."experimentVariant"
            FROM "Trace" t
            JOIN "Conversation" c ON t."conversationId" = c.id
            WHERE c."experimentVariant" = 'emergent-extraction-e1a'
            ORDER BY t.timestamp DESC
            LIMIT :limit
        """)

        with self.engine.connect() as conn:
            results = conn.execute(query, {"limit": limit})
            traces = []
            for row in results:
                traces.append({
                    'id': row[0],
                    'conversationId': row[1],
                    'extractedContext': row[2],
                    'output': row[3],
                    'qualityRating': row[4],
                    'experimentVariant': row[5],
                })
            return traces

    def display_trace_for_coding(self, trace: Dict[str, Any]):
        """Display trace themes for manual coding"""
        print("\n" + "="*80)
        print(f"Trace ID: {trace['id']}")
        print(f"Quality Rating: {trace['qualityRating'] or 'Not rated'}")
        print("="*80)

        extracted = trace['extractedContext']
        if 'themes' in extracted:
            print("\nEMERGENT THEMES:")
            for idx, theme in enumerate(extracted['themes'], 1):
                print(f"\n{idx}. {theme['theme_name']}")
                print(f"   {theme['content']}")

        print("\n" + "-"*80)
        print("DIMENSIONS TO CODE:")
        for idx, dim in enumerate(DIMENSIONS, 1):
            print(f"{idx}. {dim.replace('_', ' ').title()}")
        print("-"*80)

    def code_trace_dimensions(self, trace_id: str, dimensions_present: List[str]) -> Dict[str, Any]:
        """
        Code which dimensions are present in a trace

        Args:
            trace_id: The trace ID
            dimensions_present: List of dimension names that are present

        Returns:
            Coverage analysis dict
        """
        coverage = {dim: (dim in dimensions_present) for dim in DIMENSIONS}
        coverage_pct = (sum(coverage.values()) / len(DIMENSIONS)) * 100

        return {
            'trace_id': trace_id,
            'dimensions_coded': coverage,
            'coverage_percentage': coverage_pct,
            'dimensions_present_count': sum(coverage.values()),
            'dimensions_missing': [dim for dim, present in coverage.items() if not present],
        }

    def analyze_coverage_distribution(self, coded_traces: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Analyze coverage distribution across coded traces"""
        if not coded_traces:
            return {}

        total_traces = len(coded_traces)
        avg_coverage = sum(t['coverage_percentage'] for t in coded_traces) / total_traces

        dimension_frequencies = {dim: 0 for dim in DIMENSIONS}
        for trace in coded_traces:
            for dim, present in trace['dimensions_coded'].items():
                if present:
                    dimension_frequencies[dim] += 1

        dimension_percentages = {
            dim: (count / total_traces) * 100
            for dim, count in dimension_frequencies.items()
        }

        return {
            'total_traces_analyzed': total_traces,
            'average_coverage_pct': avg_coverage,
            'dimension_frequencies': dimension_frequencies,
            'dimension_percentages': dimension_percentages,
            'consistently_missing': [
                dim for dim, pct in dimension_percentages.items()
                if pct < 50  # Present in less than 50% of traces
            ],
        }

# Example usage
if __name__ == '__main__':
    print("Dimensional Coverage Analysis for E1a")
    print("="*80)
    print("\nThis helper loads emergent extraction traces and helps you code")
    print("which strategic dimensions are present in each trace.")
    print("\nUsage:")
    print("  analyzer = DimensionalCoverageAnalyzer()")
    print("  traces = analyzer.get_emergent_traces(limit=10)")
    print("  analyzer.display_trace_for_coding(traces[0])")
    print("  coded = analyzer.code_trace_dimensions(traces[0]['id'], ['customer_market_understanding', ...])")
    print("\nSee notebooks/dimensional_coverage_analysis.ipynb for interactive workflow")
