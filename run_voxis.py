import sys
import os

# Add backend to path (needed if run from root)
current_dir = os.path.dirname(os.path.abspath(__file__))
# Add project root to path
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.insert(0, current_dir)

from backend.server import main

if __name__ == '__main__':
    # Ensure CWD is set correctly
    os.environ['VOXIS_DEBUG'] = 'false'
    main()
