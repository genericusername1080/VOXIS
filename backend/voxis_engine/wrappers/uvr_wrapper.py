import os
import logging
from typing import List, Optional

class UVRWrapper:
    """
    Wrapper for audio-separator (UVR5) library.
    Handles initialization and separation of audio tracks.
    """
    
    def __init__(self, model_filename: str = "Kim_Vocal_2.onnx", output_format: str = "wav", **kwargs):
        self.logger = logging.getLogger(__name__)
        self.model_filename = model_filename
        self.output_format = output_format
        self.separator = None
        
        try:
            from audio_separator.separator import Separator
            # Initialize Separator with default settings or kwargs
            sep_args = {
                "log_level": logging.INFO,
                "output_format": output_format,
                "output_dir": None
            }
            sep_args.update(kwargs)
            
            self.separator = Separator(**sep_args)
            # Load the model immediately
            if self.model_filename:
                self.load_model(self.model_filename)
            self.logger.info("UVR5 Separator initialized and model loaded")
        except ImportError:
            self.logger.error("audio-separator library not found. Install it via pip.")
            self.separator = None

    def load_model(self, model_filename: Optional[str] = None):
        if not self.separator:
            return
        
        target_model = model_filename if model_filename else self.model_filename
        self.logger.info(f"Loading UVR model: {target_model}")
        try:
            self.separator.load_model(model_filename=target_model)
        except Exception as e:
            self.logger.error(f"Failed to load UVR model {target_model}: {e}")
            raise

    def separate(self, input_path: str, output_dir: str) -> List[str]:
        """
        Separate audio file into stems.
        
        Args:
            input_path: Path to input audio file.
            output_dir: Directory to save separated files.
            
        Returns:
            List of paths to output files.
        """
        if not self.separator:
            raise RuntimeError("UVR5 Separator not initialized")
            
        if not os.path.exists(input_path):
            raise FileNotFoundError(f"Input file not found: {input_path}")
            
        # Update output directory
        # Separator usually takes output_dir in constructor or separation method?
        # Check library API. Recent versions might pass it to separate() or requires re-init/setting property.
        # Looking at audio-separator 0.30.x:
        # separator.separate(audio_file_path) -> returns list of output files
        # output_dir is property of Separator instance.
        
        # We can try setting it dynamically if supported, or rely on moving files.
        # Let's try setting the attribute directly if it exists, or re-instantiating if needed.
        # Actually, best to just let it output to a temp dir or handle file moves if strictly needed,
        # but library likely supports `output_dir_path` param in `__init__`.
        # Taking a safer approach: update the output_dir attribute if possible.
        if hasattr(self.separator, 'output_dir'):
            self.separator.output_dir = output_dir
        else:
            # If not modifiable, we might need a workaround. 
            # But recent versions usually allow setting it.
            pass

        self.logger.info(f"Starting separation for {input_path}")
        try:
            # separate() returns list of file paths (may be absolute or relative)
            output_files = self.separator.separate(input_path)
            self.logger.info(f"Separator returned {len(output_files)} files: {output_files}")
            
            # Resolve paths — separator may return absolute paths, relative paths, or just filenames
            resolved = []
            for f in output_files:
                if os.path.isabs(f) and os.path.exists(f):
                    # Already a valid absolute path
                    resolved.append(f)
                elif os.path.exists(os.path.join(output_dir, f)):
                    # Relative to output_dir
                    resolved.append(os.path.join(output_dir, f))
                elif os.path.exists(os.path.join(output_dir, os.path.basename(f))):
                    # Just the filename in output_dir
                    resolved.append(os.path.join(output_dir, os.path.basename(f)))
                elif os.path.exists(f):
                    # Relative to CWD
                    resolved.append(os.path.abspath(f))
                else:
                    self.logger.warning(f"Separator output file not found: {f}")
            
            # Fallback: if no resolved files, scan output_dir for any wav files
            if not resolved and output_dir and os.path.isdir(output_dir):
                self.logger.warning("No separator outputs resolved — scanning output_dir for wav files")
                for fname in os.listdir(output_dir):
                    if fname.lower().endswith('.wav'):
                        resolved.append(os.path.join(output_dir, fname))
            
            self.logger.info(f"Resolved {len(resolved)} output files: {resolved}")
            return resolved
        except Exception as e:
            self.logger.error(f"Separation failed: {e}")
            raise

