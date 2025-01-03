import React, { useRef, useEffect, useState } from 'react';
import axios from 'axios';

function App() {
  const facialRecognitionModel = process.env.REACT_APP_FACE_RECOGNITION_MODEL || "Facenet";
  const faceDetector = process.env.REACT_APP_DETECTOR_BACKEND || "opencv";
  const distanceMetric = process.env.REACT_APP_DISTANCE_METRIC || "cosine";

  const serviceEndpoint = process.env.REACT_APP_SERVICE_ENDPOINT;
  const antiSpoofing = process.env.REACT_APP_ANTI_SPOOFING === "1"

  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const [base64Image, setBase64Image] = useState('');

  const [isVerified, setIsVerified] = useState(null);
  const [identity, setIdentity] = useState(null);

  const [isAnalyzed, setIsAnalyzed] = useState(null);
  const [analysis, setAnalysis] = useState([]);

  const [facialDb, setFacialDb] = useState({});

  const [isRegistered, setIsRegistered] = useState(null);

  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const loadFacialDb = async () => {
      const envVarsWithPrefix = {};
      for (const key in process.env) {
        if (key.startsWith("REACT_APP_USER_")) {
          envVarsWithPrefix[key.replace("REACT_APP_USER_", "")] = process.env[key];
        }
      }
      return envVarsWithPrefix;
    };

    const fetchFacialDb = async () => {
      try {
        const loadedFacialDb = await loadFacialDb();
        setFacialDb(loadedFacialDb);
      } catch (error) {
        console.error('Error loading facial database:', error);
      }
    };

    fetchFacialDb();

  }, [facialDb]);

  useEffect(() => {
    let video = videoRef.current;
    if (video) {
      const getVideo = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          video.srcObject = stream;
          await video.play();
        } catch (err) {
          console.error("Error accessing webcam: ", err);
        }
      };
      getVideo();
    }
  }, []);

  const captureImage = (task) => {
    // flush variable states when you click verify
    setIsVerified(null);
    setIdentity(null);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');

    const targetWidth = 320; // Example target width
    const targetHeight = 240; // Example target height

    canvas.width = targetWidth;//video.videoWidth;
    canvas.height = targetHeight;//video.videoHeight;

    //context.drawImage(video, 0, 0, canvas.width, canvas.height);
    context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight, 0, 0, targetWidth, targetHeight);

    /*const base64Img = canvas.toDataURL('image/png');
    setBase64Image(base64Img);

    // first click causes blank string
    if (base64Image === null || base64Image === "") {
      return
    }

    if (task === "verify") {
      verify(base64Image)
      console.log(`verification result is ${isVerified} - ${identity}`)
    }
    else if (task === "analyze") {
      analyze(base64Image)
    }
    else if (task === "register") {
      register(base64Image)
    }*/

    const imageBlob = canvas.toBlob((blob) => {
      if (!blob) return;

      console.log('size', blob.size)

      // Create FormData to send image as file
      const formData = new FormData();
      formData.append('image', blob, 'captured_image.png'); // Name it appropriately

      // Call register API to upload the image
      if (task === "verify") {
        verify(formData);
      } else if (task === "analyze") {
        analyze(formData);
      } else if (task === "register") {
        register(formData);
      }
    }, 'image/jpeg', 1);

  };

  /*const verify = async (base64Image) => {
    try {
      for (const key in facialDb) {
        const targetEmbedding = facialDb[key];

        const requestBody = JSON.stringify(
          {
            model_name: facialRecognitionModel,
            detector_backend: faceDetector,
            distance_metric: distanceMetric,
            align: true,
            img1: base64Image,
            img2: targetEmbedding,
            enforce_detection: false,
            anti_spoofing: antiSpoofing,
          }
        );

        console.log(`calling service endpoint ${serviceEndpoint}/verify`)

        const response = await fetch(`${serviceEndpoint}/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: requestBody,
        });

        const data = await response.json();

        if (response.status !== 200) {
          console.log(data.error);
          setIsVerified(false);
          return
        }

        if (data.verified === true) {
          setIsVerified(true);
          setIsAnalyzed(false);
          setIdentity(key);
          break;
        }

      }

      // if isVerified key is not true after for loop, then it is false
      if (isVerified === null) {
        setIsVerified(false);
      }

    }
    catch (error) {
      console.error('Exception while verifying image:', error);
    }

  };*/

  const analyze = async (base64Image) => {
    const result = []
    setIsAnalyzed(false)
    try {
      const requestBody = JSON.stringify(
        {
          detector_backend: faceDetector,
          align: true,
          img: base64Image,
          enforce_detection: false,
          anti_spoofing: antiSpoofing,
        }
      );

      const response = await fetch(`${serviceEndpoint}/analyze`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: requestBody,
      });

      const data = await response.json();

      if (response.status !== 200) {
        console.log(data.error);
        return
      }

      for (const instance of data.results) {
        const summary = `${instance.age} years old ${instance.dominant_race} ${instance.dominant_gender} with ${instance.dominant_emotion} mood.`
        console.log(summary)
        result.push(summary)
      }

      if (result.length > 0) {
        setIsAnalyzed(true);
        setIsVerified(null);
        setAnalysis(result);
      }

    }
    catch (error) {
      console.error('Exception while analyzing image:', error);
    }
    return result

  };

  const register = async (formData) => {
    try {
      const response = await axios.post(`${serviceEndpoint}/identity/register`,
        formData, // Send FormData with the image
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          }
        }
      );

      if (response.status !== 201) {
        console.log(response.message);
        return;
      }

      setIsError(false);
      setIsRegistered(true);
    } catch (error) {
      console.error('Exception while registering image:', error);
      setIsError(true);
      setErrorMessage(error.message);
    }
  };

  const verify = async (formData) => {
    try {
      const response = await axios.post(`${serviceEndpoint}/identity/verify`,
        formData, // Send FormData with the image
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          }
        }
      );

      if (response.status !== 201) {
        console.log(response.messsage);
        return;
      }

      setIsError(false);
      setIsVerified(true);
    } catch (error) {
      console.error('Exception while verifying image:', error);
      setIsVerified(false);
      setIsError(true);
      setErrorMessage(error.response.data.message);
    }
  };

  return (
    <div
      className="App"
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        textAlign: 'center',
        backgroundColor: '#282c34',
        color: 'white'
      }}
    >
      <header className="App-header">
        <h1>DeepFace React App</h1>
        {/* Conditional rendering based on verification status */}
        {isError && <p style={{ color: 'red' }}>{errorMessage}</p>}
        {isRegistered === true && <p style={{ color: 'green' }}>You are registered to the system. Please verify to verify your identity.</p>}
        {isVerified === true && <p style={{ color: 'green' }}>Verified. Welcome {identity}</p>}
        {isVerified === false && <p style={{ color: 'red' }}>Not Verified</p>}
        {isAnalyzed === true && <p style={{ color: 'green' }}>{analysis.join()}</p>}
        <video ref={videoRef} style={{ width: '100%', maxWidth: '500px' }} />
        <br></br><br></br>
        <button onClick={() => captureImage('register')}>Register</button>
        <button onClick={() => captureImage('verify')}>Verify</button>
        {/*<button onClick={() => captureImage('analyze')}>Analyze</button>*/}
        <br></br><br></br>
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        {/*base64Image && <img src={base64Image} alt="Captured frame" />*/}
      </header>
    </div>
  );
}

export default App;
