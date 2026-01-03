"""
Dimensional Coverage Analysis Script

This script provides tools to analyze dimensional coverage data from Experiment 2.
Use in Jupyter notebooks for interactive exploration of coverage patterns.
"""

import pandas as pd
import json
from sqlalchemy import create_engine
import os

# Connect to database
DATABASE_URL = os.getenv('DATABASE_URL')
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable not set")

# Fix SQLAlchemy 1.4+ compatibility: postgres:// -> postgresql://
if DATABASE_URL.startswith('postgres://'):
    DATABASE_URL = DATABASE_URL.replace('postgres://', 'postgresql://', 1)

engine = create_engine(DATABASE_URL)

# Strategic dimensions from taxonomy
STRATEGIC_DIMENSIONS = [
    'customer_and_market',
    'problem_and_opportunity',
    'value_proposition',
    'differentiation_and_advantage',
    'competitive_landscape',
    'business_model_and_economics',
    'go_to_market',
    'product_experience',
    'capabilities_and_assets',
    'risks_and_constraints',
]


def load_dimensional_coverage():
    """
    Load all traces with dimensional coverage data

    Returns:
        DataFrame with columns: trace_id, conversationId, timestamp,
        extractedContext, dimensionalCoverage, output, qualityRating, experimentVariant
    """
    query = """
    SELECT
        t.id as trace_id,
        t."conversationId",
        t.timestamp,
        t."extractedContext",
        t."dimensionalCoverage",
        t.output,
        t."qualityRating",
        c."experimentVariant"
    FROM "Trace" t
    JOIN "Conversation" c ON t."conversationId" = c.id
    WHERE t."dimensionalCoverage" IS NOT NULL
    ORDER BY t.timestamp DESC
    """

    df = pd.read_sql(query, engine)

    # JSON fields are already parsed by PostgreSQL/SQLAlchemy
    # No need to json.loads() - they come back as dicts already

    return df


def analyze_coverage_patterns(df):
    """
    Analyze which dimensions are typically well-covered vs sparse

    Args:
        df: DataFrame from load_dimensional_coverage()

    Returns:
        DataFrame with coverage statistics per dimension
    """
    coverage_stats = {
        'dimension': [],
        'coverage_rate': [],
        'avg_confidence_when_covered': [],
    }

    total_traces = len(df)

    for dimension in STRATEGIC_DIMENSIONS:
        covered_count = 0
        confidence_scores = []

        for idx, row in df.iterrows():
            if row['dimensionalCoverage'] is None:
                continue

            dim_data = row['dimensionalCoverage']['dimensions'].get(dimension)
            if dim_data and dim_data['covered']:
                covered_count += 1
                # Map confidence to numeric
                conf_map = {'high': 3, 'medium': 2, 'low': 1}
                confidence_scores.append(conf_map.get(dim_data['confidence'], 0))

        coverage_stats['dimension'].append(dimension)
        coverage_stats['coverage_rate'].append(covered_count / total_traces if total_traces > 0 else 0)
        coverage_stats['avg_confidence_when_covered'].append(
            sum(confidence_scores) / len(confidence_scores) if confidence_scores else 0
        )

    result = pd.DataFrame(coverage_stats)
    result = result.sort_values('coverage_rate', ascending=False)

    # Add total traces for context
    result.attrs['total_traces'] = total_traces

    return result


def find_systematic_gaps(df, threshold=0.5):
    """
    Identify dimensions that are systematically missed

    Args:
        df: DataFrame from load_dimensional_coverage()
        threshold: Coverage rate below which to consider a dimension a "gap" (default: 0.5)

    Returns:
        DataFrame with dimensions covered in less than threshold of conversations
    """
    coverage_patterns = analyze_coverage_patterns(df)

    # Dimensions covered in <threshold of conversations
    systematic_gaps = coverage_patterns[coverage_patterns['coverage_rate'] < threshold]

    return systematic_gaps


def get_theme_to_dimension_mapping(df):
    """
    Analyze which emergent themes map to which dimensions

    Args:
        df: DataFrame from load_dimensional_coverage()

    Returns:
        DataFrame with theme-to-dimension mappings
    """
    mappings = []

    for idx, row in df.iterrows():
        if row['dimensionalCoverage'] is None:
            continue

        trace_id = row['trace_id']

        for dimension in STRATEGIC_DIMENSIONS:
            dim_data = row['dimensionalCoverage']['dimensions'].get(dimension)
            if dim_data and dim_data['covered']:
                for theme_name in dim_data.get('themes', []):
                    mappings.append({
                        'trace_id': trace_id,
                        'dimension': dimension,
                        'theme_name': theme_name,
                        'confidence': dim_data['confidence'],
                    })

    return pd.DataFrame(mappings)


def get_coverage_summary_stats(df):
    """
    Get overall summary statistics for dimensional coverage

    Args:
        df: DataFrame from load_dimensional_coverage()

    Returns:
        Dictionary with summary statistics
    """
    total_traces = len(df)

    if total_traces == 0:
        return {
            'total_traces': 0,
            'avg_dimensions_covered': 0,
            'avg_coverage_percentage': 0,
            'avg_primary_dimensions': 0,
        }

    dimensions_covered = []
    coverage_percentages = []
    primary_dimensions = []

    for idx, row in df.iterrows():
        if row['dimensionalCoverage'] is None:
            continue

        summary = row['dimensionalCoverage']['summary']
        dimensions_covered.append(summary['dimensionsCovered'])
        coverage_percentages.append(summary['coveragePercentage'])
        primary_dimensions.append(len(summary['primaryDimensions']))

    return {
        'total_traces': total_traces,
        'avg_dimensions_covered': sum(dimensions_covered) / len(dimensions_covered) if dimensions_covered else 0,
        'avg_coverage_percentage': sum(coverage_percentages) / len(coverage_percentages) if coverage_percentages else 0,
        'avg_primary_dimensions': sum(primary_dimensions) / len(primary_dimensions) if primary_dimensions else 0,
    }


def compare_coverage_by_variant(df):
    """
    Compare dimensional coverage across experiment variants

    Args:
        df: DataFrame from load_dimensional_coverage()

    Returns:
        DataFrame with coverage statistics by variant
    """
    variants = df['experimentVariant'].unique()

    comparison = []
    for variant in variants:
        variant_df = df[df['experimentVariant'] == variant]
        stats = get_coverage_summary_stats(variant_df)
        stats['variant'] = variant
        comparison.append(stats)

    return pd.DataFrame(comparison)


# Example usage:
if __name__ == '__main__':
    print("Loading dimensional coverage data...")
    df = load_dimensional_coverage()
    print(f"Loaded {len(df)} traces with dimensional coverage")

    print("\nCoverage patterns:")
    coverage_patterns = analyze_coverage_patterns(df)
    print(coverage_patterns)

    print("\nSystematic gaps (coverage < 50%):")
    systematic_gaps = find_systematic_gaps(df)
    print(systematic_gaps)

    print("\nSummary statistics:")
    summary = get_coverage_summary_stats(df)
    for key, value in summary.items():
        print(f"  {key}: {value}")
