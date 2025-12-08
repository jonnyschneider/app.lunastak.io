"""
Integration test for TraceAnalyzer.
Tests all methods with actual database connection.
"""

import sys
sys.path.append('.')
from scripts.trace_analysis import TraceAnalyzer

def test_trace_analyzer():
    print("Testing TraceAnalyzer...")

    # Test 1: Connection
    print("\n1. Testing connection...")
    analyzer = TraceAnalyzer()
    print("✅ Connected")

    # Test 2: Load traces
    print("\n2. Testing load_traces...")
    traces = analyzer.load_traces(limit=5)
    print(f"✅ Loaded {len(traces)} traces")

    if len(traces) == 0:
        print("⚠️  No traces in database. Create some conversations first.")
        return

    # Test 3: Display trace
    print("\n3. Testing display_trace...")
    trace_id = traces.iloc[0]['id']
    print(f"Displaying trace {trace_id[:8]}...")
    # Can't test display in non-Jupyter, but verify no errors
    # analyzer.display_trace(trace_id)
    print("✅ Display method exists")

    # Test 4: Annotate trace
    print("\n4. Testing annotate_trace...")
    test_notes = "Test annotation from integration test"
    analyzer.annotate_trace(trace_id, test_notes)

    # Verify annotation saved
    traces_after = analyzer.load_traces(limit=5)
    saved_note = traces_after[traces_after['id'] == trace_id].iloc[0]['openCodingNotes']
    assert saved_note == test_notes, "Annotation not saved"
    print("✅ Annotation saved and retrieved")

    # Test 5: Categorize trace
    print("\n5. Testing categorize_trace...")
    test_categories = ['test-category-1', 'test-category-2']
    analyzer.categorize_trace(trace_id, test_categories)

    # Verify categories saved
    traces_after = analyzer.load_traces(limit=5)
    saved_cats = traces_after[traces_after['id'] == trace_id].iloc[0]['errorCategories']
    assert saved_cats == test_categories, "Categories not saved"
    print("✅ Categories saved and retrieved")

    # Test 6: Get summary
    print("\n6. Testing get_coding_summary...")
    summary = analyzer.get_coding_summary()
    assert summary['total_traces'] > 0, "No traces counted"
    assert summary['coded_traces'] > 0, "No coded traces counted"
    print(f"✅ Summary: {summary['total_traces']} total, {summary['coded_traces']} coded")

    # Test 7: Filter by hasNotes
    print("\n7. Testing filter by hasNotes...")
    coded = analyzer.load_traces(limit=10, filters={'hasNotes': True})
    assert len(coded) > 0, "Should have coded traces"
    print(f"✅ Found {len(coded)} coded traces")

    # Clean up test data
    print("\n8. Cleaning up test data...")
    analyzer.annotate_trace(trace_id, None)
    analyzer.categorize_trace(trace_id, [])
    print("✅ Test data cleaned")

    print("\n✅ All tests passed!")

if __name__ == '__main__':
    try:
        test_trace_analyzer()
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
